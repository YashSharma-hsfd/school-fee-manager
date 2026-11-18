import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { createClass, createFeePlan, createYear, enrollStudent, inSchool, openCharges, recordDiscount, recordPayment, reverseDiscount } from "../../src/services/fees";
import { assessLateFeesInTransaction, configureLateFees, createLateFeePolicyInTransaction, refreshLateFees } from "../../src/services/late-fees";
import { cleanupSchool } from "../helpers/cleanup-school";

describe.skipIf(process.env.FEES_E2E !== "1")("late-fee ledger in PostgreSQL", () => {
  const suffix = randomUUID().slice(0, 8);
  const users = ["ADMIN", "ACCOUNTANT", "MANAGEMENT"].map(role => ({ id: `late-${role}-${suffix}`, name: `Synthetic ${role}`, role: role as "ADMIN" | "ACCOUNTANT" | "MANAGEMENT" }));
  let schoolId: string, otherId: string, yearId: string, classId: string, planId: string;
  beforeAll(async () => {
    await prisma.user.createMany({ data: users.map(user => ({ ...user, email: `${user.id.toLowerCase()}@example.test`, passwordHash: "unused-synthetic-fixture" })) });
    schoolId = (await prisma.school.create({ data: { name: "Synthetic Late Fees", code: `LF${suffix}`.toUpperCase(), memberships: { create: users.map(user => ({ userId: user.id, role: user.role, canConfigureFees: true, canManageAccess: true })) } } })).id;
    otherId = (await prisma.school.create({ data: { name: "Other Late Fees", code: `LG${suffix}`.toUpperCase(), memberships: { create: { userId: users[0].id, role: "ADMIN", canConfigureFees: true } } } })).id;
    yearId = (await createYear(users[0], schoolId, { name: "2020-21", startsOn: "2020-04-01", endsOn: "2021-03-31" })).id;
    classId = (await createClass(users[0], schoolId, "Synthetic" )).id;
    planId = (await createFeePlan(users[0], schoolId, { academicYearId: yearId, classId, frequency: "MONTHLY", firstDueOn: "2020-04-10", components: [{ name: "Tuition", amount: "1200" }, { name: "Transport", amount: "600" }] })).id;
    await prisma.$transaction(tx => createLateFeePolicyInTransaction(tx, users[0], schoolId, planId, 10000, 1, new Date("2020-04-01")));
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    if (schoolId) await cleanupSchool(prisma, schoolId);
    if (otherId) await cleanupSchool(prisma, otherId);
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  });
  async function student() {
    const student = await prisma.student.create({ data: { schoolId, admissionNumber: randomUUID().toUpperCase(), name: "Synthetic", dateOfBirth: new Date("2010-01-01") } });
    const enrollment = await enrollStudent(users[0], schoolId, { studentId: student.id, academicYearId: yearId, classId });
    // Historical fixtures represent enrollments and assignments actually present before the deadlines.
    await prisma.enrollmentFeeAssignment.update({ where: { enrollmentId: enrollment.id }, data: { createdAt: new Date("2020-04-01") } });
    return { ...student, enrollmentId: enrollment.id };
  }
  const assess = (studentId: string, asOf: string) => inSchool(users[0], schoolId, "view", tx => assessLateFeesInTransaction(tx, schoolId, studentId, asOf));
  const penalties = (studentId: string) => prisma.studentCharge.findMany({ where: { schoolId, enrollment: { studentId }, lateFeeForDueOn: { not: null } }, orderBy: [{ dueOn: "asc" }, { lateFeeForDueOn: "asc" }] });

  it("posts 100 then 300 after grace, groups fee components and catches up without duplicate charges or audits", async () => {
    const s = await student();
    expect(await assess(s.id, "2020-04-25")).toBe(0);
    expect(await assess(s.id, "2020-04-26")).toBe(1);
    expect(await assess(s.id, "2020-05-26")).toBe(2);
    expect((await penalties(s.id)).reduce((sum, row) => sum + row.amountPaise, 0)).toBe(30000);
    await Promise.all([assess(s.id, "2020-05-26"), assess(s.id, "2020-05-26")]);
    expect(await penalties(s.id)).toHaveLength(3);
    expect(await prisma.auditEvent.count({ where: { schoolId, action: "LATE_FEE_ASSESSED", entityId: { in: (await penalties(s.id)).map(row => row.id) } } })).toBe(3);
    expect((await openCharges(prisma, schoolId, s.id)).reduce((sum, charge) => sum + charge.amountPaise - charge.settledPaise, 0)).toBe(210000);
  });
  it("posts each cycle only once under concurrent catch-up transactions", async () => {
    const s = await student();
    await Promise.all([assess(s.id, "2020-05-26"), assess(s.id, "2020-05-26")]);
    expect(await penalties(s.id)).toHaveLength(3);
  });
  it("stops recurring penalties on settled principal while preserving the existing penalty and financial totals", async () => {
    const s = await student();
    await assess(s.id, "2020-04-26");
    vi.stubEnv("LATE_FEES_ENABLED", "false");
    // Settle the April tuition and transport on April 27; April's already-earned late fee remains.
    await recordPayment(users[1], schoolId, { studentId: s.id, amount: "150", paidOn: "2020-04-27", mode: "CASH", reference: "Synthetic principal settlement", requestKey: randomUUID() });
    vi.unstubAllEnvs();
    await assess(s.id, "2020-05-26");
    const rows = await penalties(s.id);
    expect(rows).toHaveLength(2);
    expect(rows.filter(row => row.lateFeeForDueOn?.toISOString().startsWith("2020-04-10"))).toHaveLength(1);
    // Paying everything also covers penalty charges through the same allocation ledger.
    vi.stubEnv("LATE_FEES_ENABLED", "false");
    const outstanding = (await openCharges(prisma, schoolId, s.id)).reduce((sum, row) => sum + row.amountPaise - row.settledPaise, 0);
    const payment = await recordPayment(users[1], schoolId, { studentId: s.id, amount: String(outstanding / 100), paidOn: "2020-05-27", mode: "CASH", reference: "Synthetic full settlement", requestKey: randomUUID() });
    expect(await prisma.paymentAllocation.count({ where: { paymentId: payment.id, charge: { lateFeeForDueOn: { not: null } } } })).toBe(2);
    vi.unstubAllEnvs();
    expect(await assess(s.id, "2022-01-26")).toBe(0);
  });
  it("waives only late fees, deduplicates the concession, and keeps principal eligible for future cycles", async () => {
    const s = await student(); await assess(s.id, "2020-05-26");
    vi.stubEnv("LATE_FEES_ENABLED", "false");
    const input = { studentId: s.id, amount: "100", reason: "Synthetic late-fee concession", requestKey: randomUUID(), scope: "LATE_FEES" };
    const discount = await recordDiscount(users[1], schoolId, input);
    expect((await recordDiscount(users[1], schoolId, input)).id).toBe(discount.id);
    const credits = await prisma.discountAllocation.findMany({ where: { discountId: discount.id }, include: { charge: true } });
    expect(credits.every(credit => credit.charge.lateFeeForDueOn !== null && credit.charge.planItemId === null)).toBe(true);
    expect(credits.reduce((sum, credit) => sum + credit.amountPaise, 0)).toBe(10000);
    expect((await openCharges(prisma, schoolId, s.id)).filter(charge => charge.planItemId !== null).every(charge => charge.settledPaise === 0)).toBe(true);
    await expect(recordDiscount(users[1], schoolId, { ...input, requestKey: randomUUID(), amount: "201" })).rejects.toThrow("exceeds");
    await expect(recordDiscount(users[2], schoolId, { ...input, requestKey: randomUUID() })).rejects.toThrow("permission");
    await reverseDiscount(users[1], schoolId, { discountId: discount.id, reason: "Synthetic concession reversal" });
    expect((await openCharges(prisma, schoolId, s.id)).filter(charge => charge.lateFeeForDueOn !== null).reduce((sum, charge) => sum + charge.amountPaise - charge.settledPaise, 0)).toBe(30000);
    vi.unstubAllEnvs();
    expect(await assess(s.id, "2020-06-26")).toBe(3);
  });
  it("stores a configured plan's rate and frequency and schedules subsequent changes prospectively", async () => {
    const extraClass = await createClass(users[0], schoolId, "Quarterly");
    const plan = await createFeePlan(users[0], schoolId, { academicYearId: yearId, classId: extraClass.id, frequency: "QUARTERLY", firstDueOn: "2020-04-10", lateFeeAmount: "100", components: [{ name: "Tuition", amount: "1200" }] });
    const rate = await prisma.lateFeePolicy.findFirstOrThrow({ where: { schoolId, feePlanId: plan.id } });
    expect(rate).toMatchObject({ amountPaise: 10000, intervalMonths: 3, createdById: users[0].id });
    await expect(configureLateFees(users[0], schoolId, { feePlanId: plan.id, amount: "200", effectiveFrom: rate.effectiveFrom.toISOString().slice(0, 10) })).rejects.toThrow("or later");
    await configureLateFees(users[0], schoolId, { feePlanId: plan.id, amount: "0", effectiveFrom: "2090-01-01" });
    expect(await prisma.lateFeePolicy.count({ where: { schoolId, feePlanId: plan.id } })).toBe(2);
    expect((await prisma.lateFeePolicy.findUniqueOrThrow({ where: { id: rate.id } })).amountPaise).toBe(10000);
  });
  it("continues after the academic year without calculating penalties on penalty charges", async () => {
    const s = await student();
    await assess(s.id, "2021-04-26");
    expect(await penalties(s.id)).toHaveLength(90); // 1+...+12, then one more cycle for all 12 unpaid installments.
    expect((await penalties(s.id)).every(row => row.planItemId === null && row.amountPaise === 10000)).toBe(true);
  });
  it("does not backcharge a newly assigned student for earlier cycles, and the global switch preserves posted data", async () => {
    const s = await student();
    await prisma.enrollmentFeeAssignment.update({ where: { enrollmentId: s.enrollmentId }, data: { createdAt: new Date("2020-05-20") } });
    expect(await assess(s.id, "2020-05-26")).toBe(0);
    expect(await assess(s.id, "2020-06-26")).toBe(3);
    vi.stubEnv("LATE_FEES_ENABLED", "false");
    expect(await assess(s.id, "2020-07-26")).toBe(0);
    expect(await penalties(s.id)).toHaveLength(3);
  });
  it("rejects management configuration even with stale grants, cross-school plans and anonymous membership", async () => {
    const data = { feePlanId: planId, amount: "100", effectiveFrom: "2090-01-01" };
    await expect(configureLateFees(users[2], schoolId, data)).rejects.toThrow("permission");
    await expect(configureLateFees(users[0], otherId, data)).rejects.toThrow("this school");
    await expect(refreshLateFees(users[1], otherId)).rejects.toThrow("permission");
  });
  it("keeps policy versions append-only and forbids changing a posted penalty's identity", async () => {
    const s = await student(); await assess(s.id, "2020-04-26");
    const policy = await prisma.lateFeePolicy.findFirstOrThrow({ where: { schoolId, feePlanId: planId } });
    await expect(prisma.lateFeePolicy.update({ where: { id: policy.id }, data: { amountPaise: 1 } })).rejects.toThrow("append-only");
    const [charge] = await penalties(s.id);
    await expect(prisma.studentCharge.update({ where: { id: charge.id }, data: { lateFeeCycleOn: new Date("2020-05-10") } })).rejects.toThrow("immutable");
    await expect(prisma.studentCharge.create({ data: { schoolId, enrollmentId: s.enrollmentId, label: "Invalid untracked fee", amountPaise: 10000, dueOn: new Date("2020-05-26") } })).rejects.toThrow();
  });
});
