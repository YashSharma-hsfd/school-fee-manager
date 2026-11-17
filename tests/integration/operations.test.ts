import { studentProfile, studentProfileInclude } from "../../src/services/student-profile";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { hashPassword, verifyPassword } from "../../src/lib/passwords";
import { importHeaders, importStudents } from "../../src/services/student-import";
import { bulkPromote } from "../../src/services/bulk-promotion";
import { bulkEnroll, assignStudentFees } from "../../src/services/bulk-enrollment";
import { correctCharge, createClass, createFeePlan, createYear, enrollStudent, openCharges, recordDiscount, recordPayment, reverseDiscount, reversePayment } from "../../src/services/fees";
import { collectionReport, schoolReport } from "../../src/services/fee-reports";
import { createStaff, recoverStaffPassword, revokeStaffAccess } from "../../src/services/staff";
import { cleanupSchool } from "../helpers/cleanup-school";
import { changeStudentStatus } from "../../src/services/student-status";
import { schoolDashboard } from "../../src/services/dashboard";
import { transactionReport } from "../../src/services/transaction-report";

describe.skipIf(process.env.FEES_E2E !== "1")("school operations in PostgreSQL", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const admin = { id: `ops-admin-${suffix}`, name: "Synthetic Admin", role: "ADMIN" as const };
  const accountant = { id: `ops-accounts-${suffix}`, name: "Synthetic Accountant", role: "ACCOUNTANT" as const };
  const password = "Synthetic operations password 123";
  const createdUsers: string[] = [];
  let schoolId: string, otherSchoolId: string, yearId: string, nextYearId: string, classId: string, nextClassId: string;
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({ data: [admin, accountant].map(user => ({ ...user, email: `${user.id}@example.test`, passwordHash })) });
    schoolId = (await prisma.school.create({ data: { name: "Synthetic Operations", code: `OP${suffix}`.toUpperCase(), memberships: { create: [
      { userId: admin.id, role: "ADMIN", canConfigureFees: true, canManageAccess: true }, { userId: accountant.id, role: "ACCOUNTANT" },
    ] } } })).id;
    otherSchoolId = (await prisma.school.create({ data: { name: "Other Synthetic Operations", code: `OQ${suffix}`.toUpperCase(), memberships: { create: { userId: admin.id, role: "ADMIN" } } } })).id;
    yearId = (await createYear(admin, schoolId, { name: "2020-21", startsOn: "2020-04-01", endsOn: "2021-03-31" })).id;
    nextYearId = (await createYear(admin, schoolId, { name: "2021-22", startsOn: "2021-04-01", endsOn: "2022-03-31" })).id;
    classId = (await createClass(admin, schoolId, "5A")).id;
    nextClassId = (await createClass(admin, schoolId, "6A")).id;
    for (const [academicYearId, targetClass] of [[yearId, classId], [nextYearId, nextClassId], [nextYearId, classId]]) {
      await createFeePlan(admin, schoolId, { academicYearId, classId: targetClass, frequency: "ANNUAL", firstDueOn: academicYearId === yearId ? "2020-04-10" : "2021-04-10", components: [{ name: "Synthetic tuition", amount: "1000" }] });
    }
  });
  afterAll(async () => {
    if (schoolId) await cleanupSchool(prisma, schoolId);
    if (otherSchoolId) await cleanupSchool(prisma, otherSchoolId);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, accountant.id, ...createdUsers] } } });
    await prisma.$disconnect();
  });
  const csv = (admissions: string[], due = "100.01") => importHeaders.join(",") + "\n" + admissions.map(id => `${id},Synthetic Student,2010-05-10,,,,Synthetic Guardian,+49123456789,${due},2020-03-01`).join("\n");
  async function student() {
    const admissionNumber = randomUUID();
    await importStudents(admin, schoolId, csv([admissionNumber]));
    return prisma.student.findUniqueOrThrow({ where: { schoolId_admissionNumber: { schoolId, admissionNumber: admissionNumber.toUpperCase() } } });
  }
  const payment = (studentId: string, amount: string, paidOn = "2020-06-01") => ({ studentId, amount, paidOn, mode: "CASH", reference: "synthetic", requestKey: randomUUID() });
  const promotion = (studentIds: string[]) => ({ sourceYearId: yearId, sourceClassId: classId, academicYearId: nextYearId, classId: nextClassId, studentIds });

  it("rolls back the whole enrollment batch on conflict and preserves full-year charges on repeats", async () => {
    const first = await student(), second = await student();
    await enrollStudent(admin, schoolId, { studentId: second.id, academicYearId: yearId, classId, rollNumber: `CONFLICT-${suffix}` });
    await expect(bulkEnroll(admin, schoolId, { academicYearId: yearId, classId, students: [{ studentId: first.id }, { studentId: second.id, rollNumber: "DIFFERENT" }] })).rejects.toThrow("different roll number");
    expect(await prisma.enrollment.count({ where: { schoolId, studentId: first.id } })).toBe(0);
    const input = { academicYearId: yearId, classId, startsOn: "2020-11-01", students: [{ studentId: first.id }] };
    await bulkEnroll(admin, schoolId, input); await bulkEnroll(admin, schoolId, input);
    const record = await prisma.enrollment.findFirstOrThrow({ where: { schoolId, studentId: first.id, academicYearId: yearId }, include: { charges: true } });
    expect(record.charges).toHaveLength(1);
    expect(record.charges[0].amountPaise).toBe(100000);
    expect(record.charges[0].dueOn.toISOString()).toBe("2020-04-10T00:00:00.000Z");
    await expect(assignStudentFees(admin, schoolId, { enrollmentIds: [record.id] })).resolves.toEqual({ assigned: 0, unchanged: 1 });
    await expect(assignStudentFees(admin, otherSchoolId, { enrollmentIds: [record.id] })).rejects.toThrow("this school");
    expect(await prisma.studentCharge.count({ where: { enrollmentId: record.id } })).toBe(1);
  });

  it("rejects imported roll collisions atomically without creating profiles or guardians", async () => {
    const first = await student();
    const roll = `IMPORT-${suffix}`;
    await enrollStudent(admin, schoolId, { studentId: first.id, academicYearId: yearId, classId, rollNumber: roll });
    const admission = randomUUID().toUpperCase();
    const text = importHeaders.join(",") + ",rollNumber\n" + `${admission},Synthetic,2010-05-10,,2020-21,5A,Guardian,+49123456789,0,,${roll}`;
    await expect(importStudents(admin, schoolId, text)).rejects.toThrow("already used");
    expect(await prisma.student.count({ where: { schoolId, admissionNumber: admission } })).toBe(0);
  });

  it("imports opening dues without billing a new year and rejects duplicate batches atomically", async () => {
    const s = await student();
    expect(await prisma.enrollment.count({ where: { studentId: s.id } })).toBe(0);
    expect((await openCharges(prisma, schoolId, s.id))[0]).toMatchObject({ openingStudentId: s.id, amountPaise: 10001, enrollmentId: null });
    const fresh = randomUUID();
    await expect(importStudents(admin, schoolId, csv([fresh, s.admissionNumber]))).rejects.toThrow("already exists");
    expect(await prisma.student.count({ where: { schoolId, admissionNumber: fresh.toUpperCase() } })).toBe(0);
    await expect(importStudents(accountant, schoolId, csv([fresh]))).rejects.toThrow("permission");
    const received = await recordPayment(accountant, schoolId, payment(s.id, "10.01"));
    expect((await openCharges(prisma, schoolId, s.id))[0].settledPaise).toBe(1001);
    expect((await schoolReport(schoolId, 1, "overdue")).students.find(row => row.id === s.id)?.remaining).toBe(BigInt(9000));
    await reversePayment(accountant, schoolId, { paymentId: received.id, reason: "Synthetic reversal" });
  });

  it("reverses a discount exactly once and restores report balances", async () => {
    const s = await student();
    const discount = await recordDiscount(accountant, schoolId, { studentId: s.id, amount: "20", reason: "Synthetic discount", requestKey: randomUUID() });
    const before = await schoolReport(schoolId, 1, "all");
    await Promise.all([1, 2].map(() => reverseDiscount(accountant, schoolId, { discountId: discount.id, reason: "Synthetic correction" })));
    const after = await schoolReport(schoolId, 1, "all");
    expect(after.summary.outstanding - before.summary.outstanding).toBe(BigInt(2000));
    expect(before.discounts._sum.amountPaise! - (after.discounts._sum.amountPaise || 0)).toBe(2000);
    expect((await openCharges(prisma, schoolId, s.id))[0].settledPaise).toBe(0);
    expect(await prisma.discountAllocation.count({ where: { discountId: discount.id } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { schoolId, entityId: discount.id, action: "DISCOUNT_REVERSED" } })).toBe(1);
    await expect(reverseDiscount(accountant, otherSchoolId, { discountId: discount.id, reason: "Wrong school" })).rejects.toThrow("permission");
  });

  it("protects settled amounts and rejects stale charge corrections", async () => {
    const s = await student();
    await recordPayment(accountant, schoolId, payment(s.id, "30"));
    const [charge] = await openCharges(prisma, schoolId, s.id);
    const input = { chargeId: charge.id, expectedAmount: charge.amountPaise, expectedDueOn: "2020-03-01", amount: "80", dueOn: "2020-03-02", reason: "Synthetic correction" };
    await expect(correctCharge(admin, schoolId, { ...input, amount: "29.99" })).rejects.toThrow("active payments");
    await correctCharge(admin, schoolId, input);
    await expect(correctCharge(admin, schoolId, { ...input, amount: "90" })).rejects.toThrow("changed");
    expect((await openCharges(prisma, schoolId, s.id))[0]).toMatchObject({ amountPaise: 8000, settledPaise: 3000 });
    expect(await prisma.auditEvent.count({ where: { schoolId, entityId: charge.id, action: "CHARGE_CORRECTED" } })).toBe(1);
  });

  it("filters collections inclusively by payment date and excludes reversals", async () => {
    const s = await student();
    await recordPayment(accountant, schoolId, payment(s.id, "10.01", "2019-01-01"));
    const reversed = await recordPayment(accountant, schoolId, payment(s.id, "20", "2019-01-01"));
    await recordPayment(accountant, schoolId, payment(s.id, "10", "2019-01-02"));
    await reversePayment(accountant, schoolId, { paymentId: reversed.id, reason: "Synthetic correction" });
    const report = await collectionReport(schoolId, { from: "2019-01-01", to: "2019-01-01" });
    expect(report.total).toBe(BigInt(1001));
    expect(report.modes).toHaveLength(1);
    expect(report.modes[0]._count).toBe(1);
    expect((await collectionReport(otherSchoolId, {})).total).toBe(BigInt(0));
  });

  it("promotes idempotently and retains the opening balance and previous fees", async () => {
    const s = await student();
    await enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: yearId, classId });
    await expect(bulkPromote(accountant, schoolId, promotion([s.id]))).rejects.toThrow("permission");
    await bulkPromote(admin, schoolId, promotion([s.id]));
    await bulkPromote(admin, schoolId, promotion([s.id]));
    const charges = await openCharges(prisma, schoolId, s.id);
    expect(charges).toHaveLength(3);
    expect(charges.reduce((sum, c) => sum + c.amountPaise, 0)).toBe(210001);
    expect(studentProfile(await prisma.student.findUniqueOrThrow({ where: { id: s.id }, include: studentProfileInclude })).className).toBe("6A");
  });

  it("rolls back an entire promotion batch when a later student has a conflicting enrollment", async () => {
    const [first, second] = await Promise.all([student(), student()]);
    for (const s of [first, second]) await enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: yearId, classId });
    await enrollStudent(admin, schoolId, { studentId: second.id, academicYearId: nextYearId, classId });
    await expect(bulkPromote(admin, schoolId, promotion([first.id, second.id]))).rejects.toThrow("another class");
    expect(await prisma.enrollment.count({ where: { studentId: first.id, academicYearId: nextYearId } })).toBe(0);
    expect(studentProfile(await prisma.student.findUniqueOrThrow({ where: { id: first.id }, include: studentProfileInclude })).className).toBe("5A");
  });

  it("creates staff, protects shared accounts, revokes sessions and retains audits", async () => {
    const email = `new-staff-${suffix}@example.test`;
    const staffId = await createStaff(admin, schoolId, { email, name: "Synthetic New Staff", role: "ACCOUNTANT", password, currentPassword: password });
    createdUsers.push(staffId);
    await prisma.session.create({ data: { tokenHash: randomUUID(), userId: staffId, expiresAt: new Date(Date.now() + 60000) } });
    await prisma.schoolMembership.create({ data: { schoolId: otherSchoolId, userId: staffId, role: "ACCOUNTANT" } });
    const recovery = { userId: staffId, password: "Synthetic replacement password 123", currentPassword: password, reason: "Synthetic identity check" };
    await expect(recoverStaffPassword(admin, schoolId, recovery)).rejects.toThrow("schools you do not manage");
    expect(await prisma.session.count({ where: { userId: staffId } })).toBe(1);
    await prisma.schoolMembership.delete({ where: { schoolId_userId: { schoolId: otherSchoolId, userId: staffId } } });
    await recoverStaffPassword(admin, schoolId, recovery);
    expect(await prisma.session.count({ where: { userId: staffId } })).toBe(0);
    expect(await verifyPassword(recovery.password, (await prisma.user.findUniqueOrThrow({ where: { id: staffId } })).passwordHash)).toBe(true);
    await revokeStaffAccess(admin, schoolId, staffId);
    expect((await prisma.schoolMembership.findUniqueOrThrow({ where: { schoolId_userId: { schoolId, userId: staffId } } })).isActive).toBe(false);
    const events = await prisma.auditEvent.findMany({ where: { schoolId, entityId: staffId } });
    expect(events.map(event => event.action)).toEqual(expect.arrayContaining(["STAFF_ACCOUNT_CREATED", "STAFF_PASSWORD_RECOVERED", "STAFF_ACCESS_REVOKED"]));
    expect(JSON.stringify(events)).not.toContain(password);
  });

  it("preserves dues and receipt access after withdrawal, blocks promotion, and permits reactivation", async () => {
    const s = await student();
    await enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: yearId, classId });
    const current = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    const input = { studentId: s.id, status: "WITHDRAWN", expectedUpdatedAt: current.updatedAt.toISOString(), reason: "Synthetic transfer" };
    await expect(changeStudentStatus(accountant, schoolId, input)).rejects.toThrow("permission");
    await expect(changeStudentStatus(admin, otherSchoolId, input)).rejects.toThrow("not found");
    const before = await schoolDashboard(schoolId);
    await changeStudentStatus(admin, schoolId, input);
    const after = await schoolDashboard(schoolId);
    expect(after.summary.active).toBe(before.summary.active - BigInt(1));
    expect(after.summary.withdrawn).toBe(before.summary.withdrawn + BigInt(1));
    expect(after.summary.outstanding).toBe(before.summary.outstanding);
    expect(after.summary.overdue).toBe(before.summary.overdue);
    await expect(enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: nextYearId, classId: nextClassId })).rejects.toThrow("Reactivate");
    await expect(bulkPromote(admin, schoolId, promotion([s.id]))).rejects.toThrow("Reactivate");
    expect((await openCharges(prisma, schoolId, s.id)).reduce((sum, charge) => sum + charge.amountPaise, 0)).toBe(110001);
    const receipt = await recordPayment(accountant, schoolId, payment(s.id, "10"));
    expect(receipt.studentId).toBe(s.id);
    const withdrawn = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    await changeStudentStatus(admin, schoolId, { ...input, status: "ACTIVE", reason: "Synthetic return", expectedUpdatedAt: withdrawn.updatedAt.toISOString() });
    await enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: nextYearId, classId: nextClassId });
    expect(await prisma.auditEvent.count({ where: { schoolId, entityId: s.id, action: "STUDENT_STATUS_CHANGED" } })).toBe(2);
    expect((await openCharges(prisma, schoolId, s.id)).reduce((sum, charge) => sum + charge.amountPaise - charge.settledPaise, 0)).toBe(209001);
    expect((await schoolDashboard(otherSchoolId)).summary.outstanding).toBe(BigInt(0));
  });

  it("rejects competing stale lifecycle changes without duplicate audit events", async () => {
    const s = await student();
    const results = await Promise.allSettled(["INACTIVE", "WITHDRAWN"].map(status => changeStudentStatus(admin, schoolId, {
      studentId: s.id, status, expectedUpdatedAt: s.updatedAt.toISOString(), reason: "Synthetic concurrent update",
    })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { schoolId, entityId: s.id, action: "STUDENT_STATUS_CHANGED" } })).toBe(1);
  });

  it("reconciles full transaction history and scopes filters to recorded reversal dates", async () => {
    const s=await student();
    await enrollStudent(admin, schoolId, { studentId: s.id, academicYearId: yearId, classId });
    const p=await recordPayment(accountant,schoolId,payment(s.id,"20","2020-06-01"));
    const d=await recordDiscount(accountant,schoolId,{studentId:s.id,amount:"5",reason:"Synthetic history test",requestKey:randomUUID()});
    await reversePayment(accountant,schoolId,{paymentId:p.id,reason:"Synthetic reversal"});
    await reverseDiscount(accountant,schoolId,{discountId:d.id,reason:"Synthetic reversal"});
    const reversal = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    const reversalDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(reversal.reversedAt!);
    const f={q:s.admissionNumber,className:"5A",lifecycle:"ACTIVE"};
    const rows=await transactionReport(schoolId,f);
    expect(rows).toHaveLength(4);
    expect(rows.map(row=>row.kind)).toEqual(expect.arrayContaining(["PAYMENT","PAYMENT_REVERSAL","DISCOUNT","DISCOUNT_REVERSAL"]));
    expect(rows.reduce((sum,row)=>sum+row.cashPaise,0)).toBe(0);
    expect(rows.reduce((sum,row)=>sum+row.discountPaise,0)).toBe(0);
    expect(await transactionReport(schoolId,{...f,from:reversalDay,to:reversalDay})).toHaveLength(3);
    expect(await transactionReport(schoolId,{...f,mode:"CASH"})).toHaveLength(2);
    expect(await transactionReport(schoolId,{...f,lifecycle:"WITHDRAWN"})).toHaveLength(0);
    expect(await transactionReport(otherSchoolId,f)).toHaveLength(0);
    expect((await schoolReport(schoolId,1,"all",f)).students.map(row=>row.id)).toEqual([s.id]);
    expect((await schoolReport(schoolId,1,"all",{...f,className:"6A"})).students).toHaveLength(0);
    expect((await collectionReport(schoolId,f)).total).toBe(BigInt(0));
  });
});
