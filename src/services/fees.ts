import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./auth";
import { allocateOldest, dateSchema, dateOnly, FeeRuleError, installments, moneySchema } from "./fee-calculations";
import { assertSchoolPermission, type SchoolPermission } from "./school-permissions";

export const idSchema = z.string().min(1).max(128);
const nameSchema = z.string().trim().min(1).max(100);
type Tx = Prisma.TransactionClient;

export async function inSchool<T>(actor: SessionUser, schoolId: string, permission: SchoolPermission, work: (tx: Tx) => Promise<T>): Promise<T> {
  idSchema.parse(schoolId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const member = await tx.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId: actor.id } } });
        assertSchoolPermission(member, permission);
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 3) continue;
      throw error;
    }
  }
}

function auditEntityType(action: string) {
  if (["STUDENT_ENROLLED", "FEES_ASSIGNED"].includes(action)) return "Enrollment";
  if (action.startsWith("FEE_PLAN")) return "FeePlan";
  if (action.startsWith("CHARGE")) return "StudentCharge";
  if (action.startsWith("YEAR")) return "AcademicYear";
  if (action.startsWith("CLASS")) return "SchoolClass";
  if (action.startsWith("SECTION")) return "ClassSection";
  if (action.startsWith("STAFF_ACCESS")) return "SchoolMembership";
  if (action.startsWith("STAFF")) return "User";
  return action.startsWith("STUDENT") ? "Student" : action.startsWith("PAYMENT") ? "Payment" : action.startsWith("DISCOUNT") ? "Discount" : "School";
}

export async function audit(tx: Tx, actor: SessionUser, schoolId: string, action: string, entityId: string, details: Prisma.InputJsonValue) {
  await tx.auditEvent.create({ data: { schoolId, actorId: actor.id, actorName: actor.name, action, entityType: auditEntityType(action), entityId, details } });
}

export const yearSchema = z.object({ name: nameSchema, startsOn: dateSchema, endsOn: dateSchema }).refine(data => data.endsOn > data.startsOn, "Year end must follow its start");
export async function createYear(actor: SessionUser, schoolId: string, input: unknown) {
  const data = yearSchema.parse(input);
  return inSchool(actor, schoolId, "configure", async tx => {
    const overlap = await tx.academicYear.findFirst({ where: { schoolId, startsOn: { lte: data.endsOn }, endsOn: { gte: data.startsOn } } });
    if (overlap) throw new FeeRuleError("Academic years must not overlap");
    const year = await tx.academicYear.create({ data: { ...data, schoolId } });
    await audit(tx, actor, schoolId, "YEAR_CREATED", year.id, { name: year.name, startsOn: dateOnly(year.startsOn), endsOn: dateOnly(year.endsOn) });
    return year;
  });
}

export async function createClass(actor: SessionUser, schoolId: string, input: unknown) {
  const name = nameSchema.parse(input);
  return inSchool(actor, schoolId, "configure", async tx => {
    const schoolClass = await tx.schoolClass.create({ data: { schoolId, name } });
    await audit(tx, actor, schoolId, "CLASS_CREATED", schoolClass.id, { name });
    return schoolClass;
  });
}

export async function createSection(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ academicYearId: idSchema, classId: idSchema, name: nameSchema }).parse(input);
  return inSchool(actor, schoolId, "configure", async tx => {
    const year = await tx.academicYear.findFirst({ where: { schoolId, id: data.academicYearId, isClosed: false } });
    const schoolClass = await tx.schoolClass.findFirst({ where: { schoolId, id: data.classId, isActive: true } });
    if (!year || !schoolClass) throw new FeeRuleError("Select an open year and active class in this school");
    const section = await tx.classSection.create({ data: { ...data, schoolId } });
    await audit(tx, actor, schoolId, "SECTION_CREATED", section.id, data);
    return section;
  });
}

export const planSchema = z.object({
  academicYearId: idSchema, classId: idSchema,
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]), firstDueOn: dateSchema,
  components: z.array(z.object({ name: nameSchema, amount: moneySchema })).min(1).max(30),
}).refine(data => new Set(data.components.map(component => component.name.toLowerCase())).size === data.components.length, "Fee component names must be unique");

export async function createFeePlan(actor: SessionUser, schoolId: string, input: unknown) {
  const data = planSchema.parse(input);
  return inSchool(actor, schoolId, "configure", async tx => {
    const year = await tx.academicYear.findFirst({ where: { schoolId, id: data.academicYearId } });
    const schoolClass = await tx.schoolClass.findFirst({ where: { schoolId, id: data.classId } });
    if (!year || year.isClosed || !schoolClass?.isActive) throw new FeeRuleError("Select an open year and active class and academic year belonging to this school");
    if (data.firstDueOn < year.startsOn || data.firstDueOn > year.endsOn) throw new FeeRuleError("First due date must fall within the academic year");
    const count = { MONTHLY: 12, QUARTERLY: 4, ANNUAL: 1 }[data.frequency];
    const plan = await tx.feePlan.create({ data: { schoolId, academicYearId: year.id, classId: schoolClass.id, createdById: actor.id } });
    for (const component of data.components) {
      const feeComponent = await tx.feeComponent.upsert({ where: { schoolId_name: { schoolId, name: component.name } }, create: { schoolId, name: component.name }, update: {} });
      await tx.feePlanItem.createMany({ data: installments(component.amount, count, data.firstDueOn, year.endsOn).map(item => ({
        ...item, schoolId, planId: plan.id, componentId: feeComponent.id, label: component.name,
      })) });
    }
    for (const enrollment of await tx.enrollment.findMany({ where: { schoolId, academicYearId: year.id, classId: schoolClass.id, feeAssignment: null } })) await assignEnrollmentFees(tx, actor, schoolId, enrollment);
    await audit(tx, actor, schoolId, "FEE_PLAN_CREATED", plan.id, {
      academicYearId: year.id, classId: schoolClass.id, frequency: data.frequency,
      components: data.components.map(component => ({ name: component.name, amountPaise: component.amount })), firstDueOn: dateOnly(data.firstDueOn),
    });
    return plan;
  });
}

export const enrollmentSchema = z.object({ studentId: idSchema, academicYearId: idSchema, classId: idSchema,
  sectionId: z.string().max(128).optional(), rollNumber: z.string().trim().max(40).optional(),
  startsOn: z.preprocess(value => value === "" ? undefined : value, dateSchema.optional()), endsOn: z.preprocess(value => value === "" ? undefined : value, dateSchema.optional()),
});
export async function enrollStudent(actor: SessionUser, schoolId: string, input: unknown) {
  const data = enrollmentSchema.parse(input);
  return inSchool(actor, schoolId, "enroll", tx => enrollInTransaction(tx, actor, schoolId, data));
}

export async function enrollInTransaction(tx: Tx, actor: SessionUser, schoolId: string, data: z.infer<typeof enrollmentSchema>) {
  const student = await tx.student.findFirst({ where: { schoolId, id: data.studentId } });
  if (!student) throw new FeeRuleError("Student not found in this school");
  if (student.status !== "ACTIVE") throw new FeeRuleError("Reactivate this student before enrolling or promoting them. Existing dues are preserved.");
  const year = await tx.academicYear.findFirst({ where: { schoolId, id: data.academicYearId } });
  const schoolClass = await tx.schoolClass.findFirst({ where: { schoolId, id: data.classId } });
  if (!year || year.isClosed || !schoolClass?.isActive) throw new FeeRuleError("Select an open academic year and active class in this school");
  const startsOn = data.startsOn ?? (student.admissionDate && student.admissionDate > year.startsOn ? student.admissionDate : year.startsOn);
  if (startsOn < year.startsOn || startsOn > year.endsOn || (data.endsOn && (data.endsOn < startsOn || data.endsOn > year.endsOn))) throw new FeeRuleError("Enrollment dates must fall within the academic year");
  if (data.sectionId && !await tx.classSection.findFirst({ where: { schoolId, id: data.sectionId, academicYearId: year.id, classId: schoolClass.id, isActive: true } })) throw new FeeRuleError("Section must belong to the selected class and year");
  let enrollment = await tx.enrollment.findUnique({ where: { schoolId_studentId_academicYearId: { schoolId, studentId: student.id, academicYearId: year.id } } });
  if (enrollment && (enrollment.classId !== data.classId || (data.sectionId !== undefined && enrollment.sectionId !== (data.sectionId || null)))) throw new FeeRuleError("This student already has an academic-year record in another class or section. Existing placement cannot be replaced.");
  if (enrollment && data.rollNumber && enrollment.rollNumber !== data.rollNumber) throw new FeeRuleError("This student already has a different roll number for this year. Existing placement cannot be replaced.");
  if (!enrollment) {
    if (data.rollNumber && await tx.enrollment.findFirst({ where: { schoolId, academicYearId: year.id, classId: schoolClass.id, sectionId: data.sectionId || null, rollNumber: data.rollNumber } })) throw new FeeRuleError(`Roll number ${data.rollNumber} is already used in this class and section.`);
    enrollment = await tx.enrollment.create({ data: { schoolId, studentId: student.id, academicYearId: year.id, classId: schoolClass.id, sectionId: data.sectionId || null, rollNumber: data.rollNumber || null, startsOn, endsOn: data.endsOn, createdById: actor.id } });
    await audit(tx, actor, schoolId, "STUDENT_ENROLLED", enrollment.id, { studentId: student.id, academicYearId: year.id, classId: schoolClass.id });
  }
  await assignEnrollmentFees(tx, actor, schoolId, enrollment);
  return enrollment;
}

export async function assignEnrollmentFees(tx: Tx, actor: SessionUser, schoolId: string, enrollment: { id: string; academicYearId: string; classId: string }) {
  if (await tx.enrollmentFeeAssignment.findUnique({ where: { enrollmentId: enrollment.id } })) return;
  const plan = await tx.feePlan.findUnique({ where: { schoolId_academicYearId_classId: { schoolId, academicYearId: enrollment.academicYearId, classId: enrollment.classId } }, include: { items: true } });
  if (!plan || !plan.items.length) return; // The UI explicitly flags this enrollment as fees not configured.
  await tx.enrollmentFeeAssignment.create({ data: { schoolId, enrollmentId: enrollment.id, academicYearId: enrollment.academicYearId, classId: enrollment.classId, feePlanId: plan.id, createdById: actor.id } });
  await tx.studentCharge.createMany({ data: plan.items.map(item => ({ schoolId, enrollmentId: enrollment.id, planItemId: item.id, label: item.label, amountPaise: item.amountPaise, dueOn: item.dueOn })) });
  await audit(tx, actor, schoolId, "FEES_ASSIGNED", enrollment.id, { planId: plan.id });
}

export async function openCharges(tx: Tx, schoolId: string, studentId: string) {
  const charges = await tx.studentCharge.findMany({ where: { schoolId, OR: [{ enrollment: { studentId } }, { openingStudentId: studentId }] },
    include: { allocations: { where: { payment: { reversedAt: null } } }, credits: { where: { discount: { reversedAt: null } } } }, orderBy: [{ dueOn: "asc" }, { id: "asc" }] });
  return charges.map(charge => ({ ...charge, settledPaise: charge.allocations.reduce((sum, item) => sum + item.amountPaise, 0) + charge.credits.reduce((sum, item) => sum + item.amountPaise, 0) }));
}

export const paymentSchema = z.object({
  studentId: idSchema, amount: moneySchema, paidOn: dateSchema,
  mode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"]),
  reference: z.string().trim().max(160), requestKey: z.uuid(),
}).refine(data => dateOnly(data.paidOn) <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), "Payment date cannot be in the future");
const fingerprint = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

export async function recordPayment(actor: SessionUser, schoolId: string, input: unknown) {
  const data = paymentSchema.parse(input);
  const requestHash = fingerprint({ ...data, paidOn: dateOnly(data.paidOn) });
  return inSchool(actor, schoolId, "payments", async tx => {
    const prior = await tx.payment.findUnique({ where: { schoolId_requestKey: { schoolId, requestKey: data.requestKey } } });
    if (prior) {
      if (prior.requestHash !== requestHash) throw new FeeRuleError("This submission was already used with different payment details. Reload the page.");
      return prior;
    }
    const student = await tx.student.findFirst({ where: { schoolId, id: data.studentId } });
    if (!student) throw new FeeRuleError("Student not found in this school");
    const allocations = allocateOldest(data.amount, await openCharges(tx, schoolId, student.id));
    const school = await tx.school.update({ where: { id: schoolId }, data: { receiptSequence: { increment: 1 } } });
    const receiptNumber = `${school.code}-${String(school.receiptSequence).padStart(7, "0")}`;
    const payment = await tx.payment.create({ data: { schoolId, studentId: student.id, amountPaise: data.amount, paidOn: data.paidOn, mode: data.mode,
      reference: data.reference || null, receiptNumber, requestKey: data.requestKey, requestHash, recordedById: actor.id, recordedByName: actor.name,
      studentName: student.name, studentAdmissionNumber: student.admissionNumber, schoolName: school.name } });
    await tx.paymentAllocation.createMany({ data: allocations.map(allocation => ({ ...allocation, schoolId, paymentId: payment.id })) });
    await audit(tx, actor, schoolId, "PAYMENT_RECORDED", payment.id, { studentId: student.id, amountPaise: data.amount, receiptNumber, mode: data.mode, reference: data.reference, paidOn: dateOnly(data.paidOn), allocations });
    return payment;
  });
}

export const discountSchema = z.object({ studentId: idSchema, amount: moneySchema, reason: z.string().trim().min(3).max(500), requestKey: z.uuid() });
export async function recordDiscount(actor: SessionUser, schoolId: string, input: unknown) {
  const data = discountSchema.parse(input);
  const requestHash = fingerprint(data);
  return inSchool(actor, schoolId, "payments", async tx => {
    const prior = await tx.discount.findUnique({ where: { schoolId_requestKey: { schoolId, requestKey: data.requestKey } } });
    if (prior) {
      if (prior.requestHash !== requestHash) throw new FeeRuleError("This submission was already used with different discount details. Reload the page.");
      return prior;
    }
    if (!await tx.student.findFirst({ where: { schoolId, id: data.studentId } })) throw new FeeRuleError("Student not found in this school");
    const allocations = allocateOldest(data.amount, await openCharges(tx, schoolId, data.studentId));
    const discount = await tx.discount.create({ data: { schoolId, studentId: data.studentId, amountPaise: data.amount, reason: data.reason, requestKey: data.requestKey, requestHash, recordedById: actor.id, recordedByName: actor.name } });
    await tx.discountAllocation.createMany({ data: allocations.map(allocation => ({ ...allocation, schoolId, discountId: discount.id })) });
    await audit(tx, actor, schoolId, "DISCOUNT_RECORDED", discount.id, { studentId: data.studentId, amountPaise: data.amount, reason: data.reason, allocations });
    return discount;
  });
}

export async function reversePayment(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ paymentId: idSchema, reason: z.string().trim().min(3).max(500) }).parse(input);
  return inSchool(actor, schoolId, "payments", async tx => {
    const payment = await tx.payment.findFirst({ where: { schoolId, id: data.paymentId } });
    if (!payment) throw new FeeRuleError("Payment not found");
    if (payment.reversedAt) return payment;
    const reversed = await tx.payment.update({ where: { id: payment.id }, data: { reversedAt: new Date(), reversedById: actor.id, reversalReason: data.reason } });
    await audit(tx, actor, schoolId, "PAYMENT_REVERSED", payment.id, { receiptNumber: payment.receiptNumber, reason: data.reason, amountPaise: payment.amountPaise });
    return reversed;
  });
}

export async function reverseDiscount(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ discountId: idSchema, reason: z.string().trim().min(3).max(500) }).parse(input);
  return inSchool(actor, schoolId, "payments", async tx => {
    const discount = await tx.discount.findFirst({ where: { schoolId, id: data.discountId } });
    if (!discount) throw new FeeRuleError("Discount not found");
    if (discount.reversedAt) return discount;
    const reversed = await tx.discount.update({ where: { id: discount.id }, data: { reversedAt: new Date(), reversedById: actor.id, reversalReason: data.reason } });
    await audit(tx, actor, schoolId, "DISCOUNT_REVERSED", discount.id, { reason: data.reason, amountPaise: discount.amountPaise, studentId: discount.studentId });
    return reversed;
  });
}

export async function correctCharge(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ chargeId: idSchema, amount: moneySchema, dueOn: dateSchema,
    expectedAmount: z.coerce.number().int().positive(), expectedDueOn: dateSchema,
    reason: z.string().trim().min(3).max(500),
  }).parse(input);
  return inSchool(actor, schoolId, "configure", async tx => {
    const charge = await tx.studentCharge.findFirst({ where: { schoolId, id: data.chargeId }, include: {
      allocations: { where: { payment: { reversedAt: null } } }, credits: { where: { discount: { reversedAt: null } } },
    } });
    if (!charge) throw new FeeRuleError("Charge not found");
    if (charge.amountPaise === data.amount && dateOnly(charge.dueOn) === dateOnly(data.dueOn)) return charge;
    if (charge.amountPaise !== data.expectedAmount || dateOnly(charge.dueOn) !== dateOnly(data.expectedDueOn)) throw new FeeRuleError("Charge changed. Reload before correcting it.");
    const settled = charge.allocations.reduce((sum, a) => sum + a.amountPaise, 0) + charge.credits.reduce((sum, a) => sum + a.amountPaise, 0);
    if (data.amount < settled) throw new FeeRuleError("Amount cannot be less than active payments and discounts. Reverse incorrect entries first.");
    const updated = await tx.studentCharge.update({ where: { id: charge.id }, data: { amountPaise: data.amount, dueOn: data.dueOn } });
    await audit(tx, actor, schoolId, "CHARGE_CORRECTED", charge.id, {
      before: { amountPaise: charge.amountPaise, dueOn: dateOnly(charge.dueOn) },
      after: { amountPaise: data.amount, dueOn: dateOnly(data.dueOn) }, reason: data.reason,
    });
    return updated;
  });
}
