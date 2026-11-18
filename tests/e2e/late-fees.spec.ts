import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/passwords";
import { createClass, createFeePlan, createYear, enrollStudent, openCharges } from "../../src/services/fees";
import { createLateFeePolicyInTransaction } from "../../src/services/late-fees";
import { addDays, localDay } from "../../src/services/late-fee-calculations";
import { dateOnly } from "../../src/services/fee-calculations";
import { cleanupSchool } from "../helpers/cleanup-school";

test.describe("late-fee browser workflow", () => {
  test.skip(process.env.AUTH_E2E !== "1" || process.env.FEES_E2E !== "1", "Requires a migrated disposable test database");
  const suffix = randomUUID().slice(0, 8), password = "Synthetic late fee password 123";
  const users = ["ADMIN", "ACCOUNTANT", "MANAGEMENT"].map(role => ({ id: `late-ui-${role}-${suffix}`, name: `Synthetic ${role}`, role: role as "ADMIN" | "ACCOUNTANT" | "MANAGEMENT", email: `late-ui-${role.toLowerCase()}-${suffix}@example.test` }));
  const today = localDay(new Date());
  const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 1);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 12); end.setUTCDate(end.getUTCDate() - 1);
  let schoolId: string, yearId: string, classId: string, configClassId: string;
  test.beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({ data: users.map(user => ({ ...user, passwordHash })) });
    schoolId = (await prisma.school.create({ data: { name: "Synthetic Late Fee UI", code: `LU${suffix}`.toUpperCase(), memberships: { create: users.map(user => ({ userId: user.id, role: user.role, canConfigureFees: user.role === "ADMIN" })) } } })).id;
    yearId = (await createYear(users[0], schoolId, { name: "Synthetic academic year", startsOn: dateOnly(start), endsOn: dateOnly(end) })).id;
    classId = (await createClass(users[0], schoolId, "Monthly")).id;
    configClassId = (await createClass(users[0], schoolId, "Configurable")).id;
    const plan = await createFeePlan(users[0], schoolId, { academicYearId: yearId, classId, frequency: "MONTHLY", firstDueOn: dateOnly(start), components: [{ name: "Tuition", amount: "1200" }] });
    // This plan and assignment predate the missed deadlines, as in a real catch-up visit.
    await prisma.$transaction(tx => createLateFeePolicyInTransaction(tx, users[0], schoolId, plan.id, 10000, 1, start));
  });
  test.afterAll(async () => {
    if (schoolId) await cleanupSchool(prisma, schoolId);
    await prisma.loginAttempt.deleteMany({ where: { email: { in: users.map(user => user.email) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  });
  async function login(page: Page, index: number) {
    await page.context().clearCookies(); await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(users[index].email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
  }

  test("configures a late fee with the class plan and schedules a future zero rate without rewriting history", async ({ page }) => {
    await login(page, 0); await page.goto(`/schools/${schoolId}/settings`);
    const form = page.locator("#fee-plans");
    await form.locator('select[name="academicYearId"]').selectOption(yearId);
    await form.locator('select[name="classId"]').selectOption(configClassId);
    await form.getByLabel("First due date", { exact: true }).fill(dateOnly(start));
    await form.getByLabel("Fee name 1", { exact: true }).fill("Tuition");
    await form.getByLabel("Annual amount 1", { exact: true }).fill("1200");
    await form.locator('input[name="lateFeeAmount"]').fill("100");
    await form.getByRole("button", { name: "Create class fee plan", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Configuration saved");
    const plan = await prisma.feePlan.findUniqueOrThrow({ where: { schoolId_academicYearId_classId: { schoolId, academicYearId: yearId, classId: configClassId } }, include: { lateFeePolicies: true } });
    expect(plan.lateFeePolicies[0]).toMatchObject({ amountPaise: 10000, intervalMonths: 1 });
    const details = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Configurable/ }) });
    await details.locator("summary").click();
    await details.locator('input[name="amount"]').fill("0");
    await expect(details.locator('input[name="effectiveFrom"]')).toHaveValue(addDays(today, 1));
    await details.getByRole("button", { name: "Save late-fee policy", exact: true }).click();
    await expect(details.getByRole("status")).toContainText("Late-fee policy saved");
    const versions = await prisma.lateFeePolicy.findMany({ where: { schoolId, feePlanId: plan.id }, orderBy: { effectiveFrom: "asc" } });
    expect(versions.map(version => version.amountPaise)).toEqual([10000, 0]);
  });

  test("automatically catches up penalties once, restricts concessions to accountants and collects them on the receipt", async ({ page }) => {
    const student = await prisma.student.create({ data: { schoolId, admissionNumber: `LATE-${suffix}`.toUpperCase(), name: "Synthetic", dateOfBirth: new Date("2010-01-01") } });
    const enrollment = await enrollStudent(users[0], schoolId, { studentId: student.id, academicYearId: yearId, classId });
    await prisma.enrollmentFeeAssignment.update({ where: { enrollmentId: enrollment.id }, data: { createdAt: start } });
    const account = `/schools/${schoolId}/students/${student.id}`;
    await login(page, 2); await page.goto(account);
    const penalties = () => prisma.studentCharge.findMany({ where: { schoolId, enrollmentId: enrollment.id, lateFeeForDueOn: { not: null } } });
    const first = await penalties();
    expect(first).toHaveLength(Number(today.slice(-2)) >= 17 ? 3 : 1);
    expect(first.every(charge => charge.amountPaise === 10000)).toBe(true);
    await expect(page.locator("#late-fee-concession")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Record payment & issue receipt", exact: true })).toHaveCount(0);
    await login(page, 1); await page.goto(account); await page.reload();
    expect(await penalties()).toHaveLength(first.length);
    const concession = page.locator("#late-fee-concession");
    await concession.getByLabel("Late fees to waive", { exact: true }).fill("50");
    await concession.getByLabel("Reason for late-fee concession", { exact: true }).fill("Synthetic penalty concession");
    await concession.getByRole("button", { name: "Waive late fees", exact: true }).click();
    await expect(page.getByText(/Synthetic penalty concession/)).toBeVisible();
    const credits = await prisma.discountAllocation.findMany({ where: { schoolId, charge: { enrollmentId: enrollment.id } }, include: { charge: true } });
    expect(credits.reduce((sum, credit) => sum + credit.amountPaise, 0)).toBe(5000);
    expect(credits.every(credit => credit.charge.lateFeeForDueOn !== null)).toBe(true);
    const remaining = (await openCharges(prisma, schoolId, student.id)).reduce((sum, row) => sum + row.amountPaise - row.settledPaise, 0);
    await page.getByLabel("Amount paid", { exact: true }).fill(String(remaining / 100));
    await page.getByRole("button", { name: "Record payment & issue receipt", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fee payment receipt", exact: true })).toBeVisible();
    await expect(page.getByText(/Late fee: installment/).first()).toBeVisible();
    expect((await openCharges(prisma, schoolId, student.id)).every(charge => charge.amountPaise === charge.settledPaise)).toBe(true);
    expect(await penalties()).toHaveLength(first.length);
  });
});
