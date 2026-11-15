import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../../src/lib/passwords";
import { cleanupSchool } from "../helpers/cleanup-school";

test.describe("school fees browser flow", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Requires a disposable PostgreSQL database");
  const prisma = new PrismaClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 9);
  const password = "Synthetic fee browser password 123";
  const users = ["ADMIN", "ACCOUNTANT", "MANAGEMENT"].map(role => ({ id: `browser-${role}-${suffix}`, role: role as "ADMIN" | "ACCOUNTANT" | "MANAGEMENT", name: `Example ${role}`, email: `${role.toLowerCase()}-${suffix}@example.test` }));
  let schoolId: string, otherSchoolId: string;
  test.beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({ data: users.map(user => ({ ...user, passwordHash })) });
    otherSchoolId = (await prisma.school.create({ data: { name: "Other Restricted School", code: `O${suffix}`.toUpperCase(), memberships: { create: { userId: users[0].id, role: "ADMIN", configureFees: true, manageAccess: true } } } })).id;
  });
  test.afterAll(async () => {
    if (!schoolId) schoolId = (await prisma.school.findUnique({ where: { code: `B${suffix}`.toUpperCase() } }))?.id || "";
    if (schoolId) await cleanupSchool(prisma, schoolId);
    if (otherSchoolId) await cleanupSchool(prisma, otherSchoolId);
    await prisma.loginAttempt.deleteMany({ where: { email: { in: users.map(user => user.email) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  });

  test("configures fees, enrolls a student, records discounts and payments, prints receipts and reports", async ({ page, context }) => {
    test.setTimeout(120_000);
    page.on("response", response => {
      if (response.request().method() === "POST") console.log("Fee test action:", new URL(response.url()).pathname, response.status(), response.headers()["x-action-redirect"] || "no redirect");
    });
    page.on("console", message => { if (message.type() === "error") console.log("Fee test browser error:", message.text().slice(0, 800)); });
    async function login(index: number) {
      await context.clearCookies();
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(users[index].email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(index === 1 ? /\/accountant$/ : /\/schools$/);
    }
    await login(0);
    await page.goto("/schools");
    await page.getByLabel("School name", { exact: true }).fill("Example Fee School");
    await page.getByLabel("School code", { exact: true }).fill(`B${suffix}`.toUpperCase());
    await page.getByRole("button", { name: "Create school", exact: true }).click();
    await expect(page).toHaveURL(/\/schools\/[^/]+$/);
    schoolId = new URL(page.url()).pathname.split("/")[2];
    await page.getByRole("link", { name: "Configuration", exact: true }).click();
    await page.getByLabel("Year name", { exact: true }).fill("2020-21");
    await page.getByLabel("Starts on", { exact: true }).fill("2020-04-01");
    await page.getByLabel("Ends on", { exact: true }).fill("2021-03-31");
    await page.getByRole("button", { name: "Add academic year", exact: true }).click();
    await expect(page.getByText("2020-21: 2020-04-01 to 2021-03-31", { exact: true })).toBeVisible();
    await page.getByLabel("Class name", { exact: true }).fill("5A");
    await page.getByRole("button", { name: "Add class", exact: true }).click();
    await expect(page.getByLabel("Fee name 1", { exact: true })).toBeVisible();
    await page.getByLabel("First due date", { exact: true }).fill("2020-04-10");
    await page.getByLabel("Fee name 1", { exact: true }).fill("Tuition");
    await page.getByLabel("Annual amount 1", { exact: true }).fill("1200.00");
    await page.getByRole("button", { name: "Create class fee plan", exact: true }).click();
    await expect(page.locator("summary").filter({ hasText: "1,200.00 annually" })).toBeVisible();
    for (const user of users.slice(1)) {
      await page.getByLabel("Staff email", { exact: true }).fill(user.email);
      await page.getByLabel("Role", { exact: true }).selectOption(user.role);
      await page.getByRole("button", { name: "Save school access", exact: true }).click();
      await expect(page.getByText(`${user.name} (${user.email}): ${user.role}`, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Student records", exact: true }).click();
    await page.getByLabel("Student name", { exact: true }).fill("Example Fee Student");
    await page.getByLabel("Admission number", { exact: true }).fill(`FEE-${suffix}`);
    await page.getByLabel("Class", { exact: true }).fill("5A");
    await page.getByLabel("Guardian name", { exact: true }).fill("Example Guardian");
    await page.getByLabel("Guardian phone", { exact: true }).fill("1234567890");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Student added successfully");
    await page.goto(`/schools/${schoolId}`);
    await page.getByRole("link", { name: "View account", exact: true }).click();
    await expect(page).toHaveURL(/\/schools\/[^/]+\/students\/[^/]+$/);
    const accountUrl = page.url();
    await page.getByRole("button", { name: "Save academic-year record", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("previous dues are preserved");
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("1,200.00");

    await login(1);
    await page.goto(accountUrl);
    await page.getByLabel("Discount amount", { exact: true }).fill("100");
    await page.getByLabel("Reason", { exact: true }).fill("Example accountant discount");
    await page.getByRole("button", { name: "Apply discount", exact: true }).click();
    await expect(page.getByText(/100\.00 · Example accountant discount/)).toBeVisible();
    await page.getByLabel("Amount paid", { exact: true }).fill("200");
    await page.getByLabel("Payment mode", { exact: true }).selectOption("BANK_TRANSFER");
    await page.getByLabel("Transaction identifier / reference", { exact: true }).fill("SYNTHETIC-TRANSFER");
    await page.getByRole("button", { name: "Record payment & issue receipt", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fee payment receipt", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/schools\/[^/]+\/receipts\/[^/]+$/);
    await expect(page.getByText("Total received: 200.00", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print receipt", exact: true })).toBeVisible();
    const receiptUrl = page.url();
    await login(2);
    await page.goto(`/schools/${schoolId}/reports`);
    await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Outstanding", exact: true }) })).toContainText("900.00");
    await expect(page.getByRole("article").filter({ hasText: "Total received (all time)" })).toContainText("200.00");
    await page.goto(accountUrl);
    await expect(page.getByRole("button", { name: "Record payment & issue receipt", exact: true })).toHaveCount(0);
    await page.goto(`/schools/${otherSchoolId}`);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await login(1);
    await page.goto(receiptUrl);
    await page.getByLabel("Reason for reversal", { exact: true }).fill("Example recording correction");
    await page.getByRole("button", { name: "Reverse payment", exact: true }).click();
    await expect(page.getByText(/REVERSED — Example recording correction/)).toBeVisible();
    await page.goto(accountUrl);
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("1,100.00");
  });
});
