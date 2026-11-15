import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { createClass, createFeePlan, createYear, enrollStudent, openCharges, recordDiscount, recordPayment, reversePayment } from "../../src/services/fees";
import { balances } from "../../src/services/fee-calculations";
import { schoolReport } from "../../src/services/fee-reports";
import { cleanupSchool } from "../helpers/cleanup-school";

describe.skipIf(process.env.FEES_E2E !== "1")("PostgreSQL fee ledger", () => {
  const prefix = randomUUID().replaceAll("-", "").slice(0, 9);
  const admin = { id: `fee-admin-${prefix}`, name: "Example Admin", role: "ADMIN" as const };
  const accountant = { id: `fee-accountant-${prefix}`, name: "Example Accountant", role: "ACCOUNTANT" as const };
  const manager = { id: `fee-manager-${prefix}`, name: "Example Manager", role: "MANAGEMENT" as const };
  let schoolId: string, otherSchoolId: string, yearId: string, classId: string;
  beforeAll(async () => {
    for (const actor of [admin, accountant, manager]) await prisma.user.create({ data: { ...actor, email: `${actor.id}@example.test`, passwordHash: "not-a-login-account" } });
    schoolId = (await prisma.school.create({ data: { name: "Synthetic Fee School", code: `F${prefix}`.toUpperCase(), memberships: { create: [
      { userId: admin.id, role: "ADMIN", configureFees: true }, { userId: accountant.id, role: "ACCOUNTANT" }, { userId: manager.id, role: "MANAGEMENT" },
    ] } } })).id;
    otherSchoolId = (await prisma.school.create({ data: { name: "Other Synthetic School", code: `G${prefix}`.toUpperCase(), memberships: { create: { userId: admin.id, role: "ADMIN", configureFees: true } } } })).id;
    yearId = (await createYear(admin, schoolId, { name: "2020–21", startsOn: "2020-04-01", endsOn: "2021-03-31" })).id;
    classId = (await createClass(admin, schoolId, "5A")).id;
    await createFeePlan(admin, schoolId, { academicYearId: yearId, classId, frequency: "MONTHLY", firstDueOn: "2020-04-10", components: [{ name: "Example Tuition", amount: "1200.01" }] });
  });
  afterAll(async () => {
    if (schoolId) await cleanupSchool(prisma, schoolId);
    if (otherSchoolId) await cleanupSchool(prisma, otherSchoolId);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, accountant.id, manager.id] } } });
    await prisma.$disconnect();
  });
  async function student() {
    const record = await prisma.student.create({ data: { schoolId, admissionNumber: randomUUID(), name: "Example Student", className: "5A", guardianName: "Example Guardian", guardianPhone: "1234567890" } });
    await enrollStudent(admin, schoolId, { studentId: record.id, academicYearId: yearId, classId });
    return record;
  }
  const payment = (studentId: string, amount: string, requestKey = randomUUID()) => ({ studentId, amount, paidOn: "2020-06-01", mode: "BANK_TRANSFER", reference: "synthetic-reference", requestKey });

  it("isolates schools and roles, including fee configuration", async () => {
    await expect(createClass(accountant, schoolId, "Forbidden")).rejects.toThrow("permission");
    await expect(recordPayment(manager, schoolId, payment("unknown", "10"))).rejects.toThrow("permission");
    await expect(createClass(accountant, otherSchoolId, "Forbidden")).rejects.toThrow("permission");
    const record = await student();
    await expect(enrollStudent(admin, otherSchoolId, { studentId: record.id, academicYearId: yearId, classId })).rejects.toThrow("Student not found");
    // Identical admission numbers may exist in independent schools.
    await prisma.student.create({ data: { schoolId: otherSchoolId, admissionNumber: record.admissionNumber, name: "Other Example", className: "5A", guardianName: "Example", guardianPhone: "1234567890" } });
  });
  it("assigns fees exactly once and preserves old dues when promoted", async () => {
    const record = await student();
    await enrollStudent(admin, schoolId, { studentId: record.id, academicYearId: yearId, classId });
    expect(await prisma.studentCharge.count({ where: { schoolId, enrollment: { studentId: record.id } } })).toBe(12);
    const nextYear = await createYear(admin, schoolId, { name: "2021–22", startsOn: "2021-04-01", endsOn: "2022-03-31" });
    const nextClass = await createClass(admin, schoolId, "6A");
    await createFeePlan(admin, schoolId, { academicYearId: nextYear.id, classId: nextClass.id, frequency: "QUARTERLY", firstDueOn: "2021-04-10", components: [{ name: "Example Tuition", amount: "2400" }] });
    await enrollStudent(admin, schoolId, { studentId: record.id, academicYearId: nextYear.id, classId: nextClass.id });
    expect(balances(await openCharges(prisma, schoolId, record.id), new Date()).outstanding).toBe(360001);
    expect(await prisma.enrollment.count({ where: { schoolId, studentId: record.id } })).toBe(2);
    await expect(enrollStudent(admin, schoolId, { studentId: record.id, academicYearId: yearId, classId: nextClass.id })).rejects.toThrow();
  });
  it("accepts arbitrary partial payments, discounts and immutable receipt identity", async () => {
    const record = await student();
    const first = await recordPayment(accountant, schoolId, payment(record.id, "100"));
    await recordPayment(accountant, schoolId, payment(record.id, "100"));
    await recordPayment(accountant, schoolId, payment(record.id, "300"));
    await recordDiscount(accountant, schoolId, { studentId: record.id, amount: "50", reason: "Example discount", requestKey: randomUUID() });
    expect(balances(await openCharges(prisma, schoolId, record.id), new Date()).outstanding).toBe(65001);
    await prisma.student.update({ where: { id: record.id }, data: { name: "Renamed Example" } });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: first.id } })).studentName).toBe("Example Student");
    await reversePayment(accountant, schoolId, { paymentId: first.id, reason: "Example correction" });
    expect(balances(await openCharges(prisma, schoolId, record.id), new Date()).outstanding).toBe(75001);
    expect(await prisma.auditEvent.count({ where: { schoolId, entityId: first.id } })).toBe(2);
  });
  it("deduplicates concurrent payment retries and rejects changed payloads", async () => {
    const record = await student(); const data = payment(record.id, "100");
    const [first, second] = await Promise.all([recordPayment(accountant, schoolId, data), recordPayment(accountant, schoolId, data)]);
    expect(first.id).toBe(second.id);
    expect(await prisma.payment.count({ where: { schoolId, requestKey: data.requestKey } })).toBe(1);
    await expect(recordPayment(accountant, schoolId, { ...data, amount: "200" })).rejects.toThrow("different payment details");
    expect((await prisma.paymentAllocation.aggregate({ where: { paymentId: first.id }, _sum: { amountCents: true } }))._sum.amountCents).toBe(10000);
  });
  it("prevents concurrent overpayment and leaves no partial ledger writes", async () => {
    const record = await student();
    const results = await Promise.allSettled([recordPayment(accountant, schoolId, payment(record.id, "900")), recordPayment(accountant, schoolId, payment(record.id, "900"))]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.payment.count({ where: { schoolId, studentId: record.id } })).toBe(1);
    expect(balances(await openCharges(prisma, schoolId, record.id), new Date()).outstanding).toBe(30001);
  });
  it("makes report totals agree with charge-level balances", async () => {
    const report = await schoolReport(schoolId, 1, "all");
    const charges = await prisma.studentCharge.findMany({ where: { schoolId }, include: { allocations: { where: { payment: { reversedAt: null } } }, credits: true } });
    const remaining = charges.reduce((sum, charge) => sum + charge.amountCents - charge.allocations.reduce((n, item) => n + item.amountCents, 0) - charge.credits.reduce((n, item) => n + item.amountCents, 0), 0);
    expect(Number(report.summary.outstanding)).toBe(remaining);
    expect(Number(report.summary.overdue)).toBe(remaining);
  });
});
