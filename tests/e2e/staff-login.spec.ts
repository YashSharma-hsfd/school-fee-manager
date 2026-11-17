const baseURL = `http://localhost:${process.env.PLAYWRIGHT_TEST_PORT || "3000"}`;
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../../src/lib/passwords";
import { cleanupSchool } from "../helpers/cleanup-school";

// Opt in only against a migrated, disposable development/test database.
test.describe("database-backed staff login", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Requires AUTH_E2E=1 and a disposable PostgreSQL database");
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  let schoolId: string;
  const password = "Synthetic browser password 123";
  const accounts = [
    { id: `e2e-admin-${suffix}`, email: `admin-${suffix}@example.test`, name: "Example Admin", role: "ADMIN" as const },
    { id: `e2e-accountant-${suffix}`, email: `accountant-${suffix}@example.test`, name: "Example Accountant", role: "ACCOUNTANT" as const },
  ];

  test.beforeAll(async () => {
    await prisma.user.createMany({ data: accounts.map(account => ({ ...account, passwordHash: "pending" })) });
    const passwordHash = await hashPassword(password);
    await prisma.user.updateMany({ where: { id: { in: accounts.map(account => account.id) } }, data: { passwordHash } });
    const school = await prisma.school.create({ data: { name: "Example Test School", code: `T${suffix.replaceAll("-", "").slice(0, 10)}`.toUpperCase(), memberships: { create: accounts.map(account => ({ userId: account.id, role: account.role })) } } });
    schoolId = school.id;
  });
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "school-fee-active-school", value: schoolId, domain: "localhost", path: "/" }]);
  });
  test.afterAll(async () => {
    if (schoolId) await cleanupSchool(prisma, schoolId);
    await prisma.user.deleteMany({ where: { id: { in: accounts.map(account => account.id) } } });
    await prisma.loginAttempt.deleteMany({ where: { email: { in: accounts.map(account => account.email) } } });
    await prisma.$disconnect();
  });

  test("admin adds and searches students; accountant cannot access records", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(accounts[0].email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.getByRole("button", { name: "Manage students", exact: true }).click();
    await page.getByLabel("Student name", { exact: true }).fill("Synthetic UI Student");
    await page.getByLabel("Admission number", { exact: true }).fill(`UI-${suffix}`);
    await page.getByLabel("Date of birth", { exact: true }).fill("2010-05-10");
    await page.getByLabel("Guardian name", { exact: true }).fill("Synthetic Guardian");
    await page.getByLabel("Guardian phone", { exact: true }).fill("+49 123456789");
    await page.getByRole("group", { name: "Add student", exact: true }).getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Student added successfully");
    await page.getByLabel("Search students").fill(`UI-${suffix}`);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Synthetic UI Student", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Edit Synthetic UI Student", exact: true }).click();
    await expect(page.getByLabel("Student name", { exact: true })).toHaveValue("Synthetic UI Student");
    const editUrl = page.url();
    await page.getByLabel("Student name", { exact: true }).fill("Cancelled Edit");
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await page.goto(editUrl);
    await expect(page.getByLabel("Student name", { exact: true })).toHaveValue("Synthetic UI Student");
    await page.getByLabel("Student name", { exact: true }).fill("Updated UI Student");
    await page.getByLabel("Guardian phone", { exact: true }).fill("+49 987654321");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Student updated successfully");
    await page.getByLabel("Search students").fill(`UI-${suffix}`);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "Updated UI Student" })).toContainText("+49 987654321");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByLabel("Email").fill(accounts[1].email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/accountant$/);
    await page.goto("/admin/students");
    await expect(page).toHaveURL(`${baseURL}/schools`);
    await page.goto(editUrl);
    await expect(page).toHaveURL(`${baseURL}/schools`);
  });

  for (const account of accounts) {
    test(`${account.role} signs in, cannot cross roles, and signs out`, async ({ page }) => {
      const previousSessions = await prisma.session.count({ where: { userId: account.id } });
      await page.goto("/login");
      await page.getByLabel("Email").fill(account.email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const home = account.role === "ADMIN" ? "/admin/dashboard" : "/accountant";
      await expect(page).toHaveURL(`${baseURL}${home}`);
      await page.goto(account.role === "ADMIN" ? "/accountant" : "/admin/dashboard");
      await expect(page).toHaveURL(account.role === "ADMIN" ? `${baseURL}${home}` : `${baseURL}/schools/${schoolId}`);
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login$/);
      expect(await prisma.session.count({ where: { userId: account.id } })).toBe(previousSessions);
      await page.goto(home);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
  test("rejects incorrect credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(accounts[0].email);
    await page.getByLabel("Password").fill("Incorrect synthetic password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Unable to sign in");
    await expect(page).toHaveURL(/\/login$/);
  });
});
