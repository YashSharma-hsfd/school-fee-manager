import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/passwords";
import { importHeaders, importStudents } from "../../src/services/student-import";
import { createClass, createYear, createFeePlan, enrollStudent, recordDiscount, recordPayment } from "../../src/services/fees";
import { cleanupSchool } from "../helpers/cleanup-school";

test.describe("school operations browser flows", () => {
  test.skip(process.env.AUTH_E2E !== "1" || process.env.FEES_E2E !== "1", "Requires a migrated disposable database");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const password = "Synthetic operations browser password 123";
  const users = ["ADMIN", "ACCOUNTANT", "MANAGEMENT"].map(role => ({ id: `ops-ui-${role}-${suffix}`, name: `Synthetic ${role}`, role: role as "ADMIN" | "ACCOUNTANT" | "MANAGEMENT", email: `ops-ui-${role.toLowerCase()}-${suffix}@example.test` }));
  const createdUsers: string[] = [];
  let schoolId: string, otherSchoolId: string, yearId: string, nextYearId: string, classId: string, nextClassId: string;
  test.beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({ data: users.map(user => ({ ...user, passwordHash })) });
    schoolId = (await prisma.school.create({ data: { name: "Synthetic Operations UI", code: `UI${suffix}`.toUpperCase(), memberships: { create: users.map(user => ({ userId: user.id, role: user.role, canConfigureFees: user.role === "ADMIN", canManageAccess: user.role === "ADMIN" })) } } })).id;
    otherSchoolId = (await prisma.school.create({ data: { name: "Other Operations UI", code: `UJ${suffix}`.toUpperCase() } })).id;
    yearId = (await createYear(users[0], schoolId, { name: "2020-21", startsOn: "2020-04-01", endsOn: "2021-03-31" })).id;
    nextYearId = (await createYear(users[0], schoolId, { name: "2021-22", startsOn: "2021-04-01", endsOn: "2022-03-31" })).id;
    classId = (await createClass(users[0], schoolId, "5A")).id;
    nextClassId = (await createClass(users[0], schoolId, "6A")).id;
    for (const [academicYearId, targetClass, firstDueOn] of [[yearId, classId, "2020-04-10"], [nextYearId, nextClassId, "2021-04-10"]]) {
      await createFeePlan(users[0], schoolId, { academicYearId, classId: targetClass, frequency: "ANNUAL", firstDueOn, components: [{ name: "Tuition", amount: "1000" }] });
    }
  });
  test.afterAll(async () => {
    if (schoolId) {
      // Also find a UI-created account if a browser assertion failed before its ID was captured.
      const staff = await prisma.user.findUnique({ where: { email: `created-ops-${suffix}@example.test` } });
      if (staff) createdUsers.push(staff.id);
      await cleanupSchool(prisma, schoolId);
    }
    if (otherSchoolId) await cleanupSchool(prisma, otherSchoolId);
    await prisma.loginAttempt.deleteMany({ where: { email: { in: [...users.map(user => user.email), `created-ops-${suffix}@example.test`] } } });
    await prisma.user.deleteMany({ where: { id: { in: [...users.map(user => user.id), ...createdUsers] } } });
    await prisma.$disconnect();
  });
  async function login(page: Page, email = users[0].email, secret = password) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
  }
  async function student() {
    const admissionNumber = randomUUID().toUpperCase();
    await importStudents(users[0], schoolId, importHeaders.join(",") + `\n${admissionNumber},Synthetic Flow Student,2010-05-10,,,,Synthetic Guardian,+49123456789,0,`);
    const s = await prisma.student.findUniqueOrThrow({ where: { schoolId_admissionNumber: { schoolId, admissionNumber } } });
    await enrollStudent(users[0], schoolId, { studentId: s.id, academicYearId: yearId, classId });
    return s;
  }

  test("previews CSV before import and shows opening dues in the account and reports", async ({ page }) => {
    await login(page);
    await page.goto(`/schools/${schoolId}/operations`);
    const admissionNumber = `UI-${suffix}`.toUpperCase();
    const text = importHeaders.join(",") + `\n${admissionNumber},Synthetic Imported Student,2010-05-10,,,,Synthetic Guardian,+49123456789,123.45,2020-03-01`;
    await page.getByLabel("Student CSV").setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(text) });
    await page.getByRole("button", { name: "Preview import", exact: true }).click();
    await expect(page.getByText("1 students ready. No records have been written.", { exact: true })).toBeVisible();
    expect(await prisma.student.count({ where: { schoolId, admissionNumber } })).toBe(0);
    await page.getByRole("button", { name: "Confirm import of 1 students", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Imported 1 students");
    const s = await prisma.student.findUniqueOrThrow({ where: { schoolId_admissionNumber: { schoolId, admissionNumber } } });
    await page.goto(`/schools/${schoolId}/students/${s.id}`);
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("123.45");
    await expect(page.getByText("Imported opening balance", { exact: true })).toBeVisible();
    const overdue = await page.request.get(`/schools/${schoolId}/reports/export?kind=overdue`);
    expect(overdue.status()).toBe(200);
    expect(await overdue.text()).toContain('"123.45","123.45"');
  });

  test("corrects a charge, reverses discounts, exports collections and filters the audit trail", async ({ page }) => {
    const s = await student();
    await recordPayment(users[1], schoolId, { studentId: s.id, amount: "50", paidOn: "2020-06-01", mode: "BANK_TRANSFER", reference: "SYNTHETIC-OPS", requestKey: randomUUID() });
    await recordDiscount(users[1], schoolId, { studentId: s.id, amount: "20", reason: "Synthetic discount", requestKey: randomUUID() });
    await login(page);
    await page.goto(`/schools/${schoolId}/students/${s.id}`);
    await page.getByText("Correct charge", { exact: true }).click();
    await page.getByLabel("Corrected charge amount", { exact: true }).fill("900");
    await page.getByLabel("Reason for correction", { exact: true }).fill("Synthetic fee correction");
    await page.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Charge corrected");
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("830.00");
    await login(page, users[1].email);
    await page.goto(`/schools/${schoolId}/students/${s.id}`);
    await page.locator("summary").filter({ hasText: /^Reverse discount$/ }).click();
    await page.getByLabel("Reason for discount reversal", { exact: true }).fill("Synthetic discount correction");
    await page.getByRole("button", { name: "Reverse discount", exact: true }).click();
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("850.00");
    await page.goto(`/schools/${schoolId}/reports?from=2020-06-01&to=2020-06-01&action=CHARGE_CORRECTED`);
    await expect(page.getByText("Net received: 50.00", { exact: true })).toBeVisible();
    await expect(page.locator("details > summary")).toHaveCount(1);
    await page.locator("details > summary").click();
    await expect(page.locator("details pre")).toContainText("Synthetic fee correction");
    const exported = await page.request.get(`/schools/${schoolId}/reports/export?kind=collections&from=2020-06-01&to=2020-06-01`);
    expect(exported.status()).toBe(200);
    expect(exported.headers()["cache-control"]).toBe("private, no-store");
    expect(await exported.text()).toContain('"SYNTHETIC-OPS","50.00"');
    expect((await page.request.get(`/schools/${otherSchoolId}/reports/export?kind=collections`)).status()).toBe(404);
    expect((await page.request.get(`/schools/${schoolId}/reports/export?kind=collections&from=2020-07-01&to=2020-06-01`)).status()).toBe(400);
    await page.getByLabel("Name, admission or guardian", { exact: true }).fill(s.admissionNumber);
    await page.locator('select[name="className"]').selectOption("5A");
    await page.locator('select[name="lifecycle"]').selectOption("ACTIVE");
    await page.locator('select[name="mode"]').selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`q=${s.admissionNumber}`));
    const balances=page.locator("section").filter({has:page.getByRole("heading",{name:"Current student balances",exact:true})});
    await expect(balances.getByRole("link",{name:s.name,exact:true})).toHaveCount(1);
    await expect(page.getByRole("link",{name:"Download all matching transactions CSV",exact:true})).toHaveAttribute("href",new RegExp(`q=${s.admissionNumber}`));
    await page.getByRole("link",{name:"Clear filters",exact:true}).click();
    await expect(page.getByLabel("Name, admission or guardian",{exact:true})).toHaveValue("");
    await expect(page.locator('select[name="className"]')).toHaveValue("");
    await expect(page.locator('select[name="mode"]')).toHaveValue("ALL");
  });

  test("promotes selected students and preserves previous dues", async ({ page }) => {
    const s = await student();
    await login(page);
    await page.goto(`/schools/${schoolId}/operations?${new URLSearchParams({ sourceYearId: yearId, sourceClassId: classId, academicYearId: nextYearId, classId: nextClassId })}`);
    await expect(page.getByText("Destination fees per student: 1,000.00", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: new RegExp(s.admissionNumber) }).check();
    await page.getByRole("button", { name: "Confirm promotion of selected students", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved 1 promotions");
    await page.goto(`/schools/${schoolId}/students/${s.id}`);
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("2,000.00");
    await expect(page.locator("#academic-history").getByText("2020-21", { exact: false })).toBeVisible();
    await expect(page.locator("#academic-history").getByText("2021-22", { exact: false })).toBeVisible();
  });

  test("creates staff, recovers a password and lets staff change their own password", async ({ page }) => {
    const email = `created-ops-${suffix}@example.test`;
    await login(page);
    await page.goto(`/schools/${schoolId}/settings`);
    const create = page.locator("section").filter({ has: page.getByRole("heading", { name: "Create staff account", exact: true }) });
    await create.getByLabel("New staff name", { exact: true }).fill("Synthetic Created Staff");
    await create.getByLabel("New staff email", { exact: true }).fill(email);
    await create.getByLabel("Initial password (at least 12 characters)", { exact: true }).fill(password);
    await create.getByLabel("Your current password", { exact: true }).fill(password);
    await create.getByRole("button", { name: "Create staff account", exact: true }).click();
    await expect(create.getByRole("status")).toContainText("Staff account created");
    await expect(create.getByLabel("Initial password (at least 12 characters)", { exact: true })).toHaveValue("");
    const staff = await prisma.user.findUniqueOrThrow({ where: { email } });
    createdUsers.push(staff.id);
    const manage = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Manage Synthetic Created Staff" }) });
    await manage.locator("summary").click();
    const replacement = "Synthetic recovered password 123";
    await manage.getByLabel("New staff password", { exact: true }).fill(replacement);
    await manage.getByLabel("Your current password", { exact: true }).fill(password);
    await manage.getByLabel("Recovery reason", { exact: true }).fill("Synthetic identity verification");
    await manage.getByRole("button", { name: "Reset staff password", exact: true }).click();
    await expect(manage.getByRole("status")).toContainText("Password reset");
    await login(page, email, replacement);
    await page.goto("/account");
    await page.getByLabel("Current password", { exact: true }).fill(replacement);
    await page.getByLabel("New password (at least 12 characters)", { exact: true }).fill("Synthetic personal password 456");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Synthetic personal password 456");
    await page.getByRole("button", { name: "Change password and sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(0);
    await login(page, email, "Synthetic personal password 456");
  });

  test("withdraws and reactivates a student while retaining dues and dashboard collections", async ({ page }) => {
    const s = await student();
    const account = `/schools/${schoolId}/students/${s.id}`;
    await login(page);
    await page.goto(account);
    await page.locator("summary").filter({ hasText: /^Change student status$/ }).click();
    await page.getByLabel("New student status", { exact: true }).selectOption("WITHDRAWN");
    await page.getByLabel("Reason for status change", { exact: true }).fill("Synthetic transfer to another school");
    await page.getByRole("button", { name: "Save student status", exact: true }).click();
    await expect(page.getByText("Student status: Withdrawn", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("1,000.00");
    await expect(page.getByRole("button", { name: "Save academic-year record", exact: true })).toHaveCount(0);
    await page.goto(`/schools/${schoolId}?status=WITHDRAWN&q=${s.admissionNumber}`);
    await expect(page.getByRole("link", { name: "View account", exact: true })).toHaveCount(1);
    await login(page, users[1].email);
    await page.goto(account);
    await expect(page.getByText("Change student status", { exact: true })).toHaveCount(0);
    await page.getByLabel("Amount paid", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Record payment & issue receipt", exact: true }).click();
    await expect(page.getByText("Total received: 10.00", { exact: true })).toBeVisible();
    await page.goto(`/schools/${schoolId}`);
    await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Collected today", exact: true }) })).toContainText("10.00");
    await expect(page.getByRole("link", { name: "Find student / collect payment", exact: true })).toBeVisible();
    await login(page);
    await page.goto(account);
    await page.locator("summary").filter({ hasText: /^Change student status$/ }).click();
    await page.getByLabel("New student status", { exact: true }).selectOption("ACTIVE");
    await page.getByLabel("Reason for status change", { exact: true }).fill("Synthetic return to school");
    await page.getByRole("button", { name: "Save student status", exact: true }).click();
    await expect(page.getByText("Student status: Active", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save academic-year record", exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("990.00");
  });

  test("guides each school role through navigation, student lookup and its account tasks", async ({page}) => {
    const s=await student();
    for(const [index,title] of ["Admin workspace","Accountant workspace","Management workspace"].entries()){
      await login(page,users[index].email);
      await page.goto(`/schools/${schoolId}`);
      await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
      const navigation=page.getByRole("navigation",{name:"School navigation",exact:true});
      await expect(navigation.getByRole("link",{name:"Overview",exact:true})).toHaveAttribute("aria-current","page");
      await navigation.getByRole("link",{name:"Student accounts",exact:true}).click();
      await expect(page).toHaveURL(new RegExp(`/schools/${schoolId}/students$`));
      await expect(navigation.getByRole("link",{name:"Student accounts",exact:true})).toHaveAttribute("aria-current","page");
      await page.getByLabel("Find student",{exact:true}).fill(s.admissionNumber);
      await page.getByRole("button",{name:"Search",exact:true}).click();
      await page.getByRole("link",{name:"View account",exact:true}).click();
      await expect(page.getByRole("heading",{name:s.name,exact:true})).toBeVisible();
      await expect(page.getByRole("link",{name:"Collect payment",exact:true})).toHaveCount(index===1?1:0);
      await expect(page.getByRole("link",{name:"Enroll / promote",exact:true})).toHaveCount(index!==1?1:0);
      await expect(navigation.getByRole("button",{name:"Add student",exact:true})).toHaveCount(index===0?1:0);
      await navigation.getByRole("link",{name:"Reports & audit",exact:true}).click();
      await expect(navigation.getByRole("link",{name:"Reports & audit",exact:true})).toHaveAttribute("aria-current","page");
    }
  });
  test("management bulk enrolls new records with individual rolls while import and configuration remain restricted", async ({ page }) => {
    const prefix = `BULK-${randomUUID().slice(0, 12)}`.toUpperCase();
    const admissions = [`${prefix}-A`, `${prefix}-B`];
    await importStudents(users[0], schoolId, importHeaders.join(",") + "\n" + admissions.map((admission, index) => `${admission},Synthetic${index ? "Beta" : "Alpha"},2010-05-10,,,,Guardian,+49123456789,0,`).join("\n"));
    await login(page, users[2].email);
    await page.goto(`/schools/${schoolId}/operations`);
    await expect(page.getByLabel("Student CSV")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "School navigation", exact: true }).getByRole("link", { name: "Configuration", exact: true })).toHaveCount(0);
    const batch = page.locator("#bulk-enrollment");
    await batch.getByLabel("Academic year", { exact: true }).selectOption(nextYearId);
    await batch.getByLabel("Class", { exact: true }).selectOption(nextClassId);
    await batch.getByLabel("Student name or admission number", { exact: true }).fill(prefix);
    await batch.getByRole("button", { name: "Preview enrollment and fees", exact: true }).click();
    await batch.getByLabel("Select all shown", { exact: true }).check();
    await batch.getByLabel("Roll number for SyntheticAlpha", { exact: true }).fill(`A-${suffix}`);
    await batch.getByLabel("Roll number for SyntheticBeta", { exact: true }).fill(`B-${suffix}`);
    await batch.locator('input[name="startsOn"]').fill("2021-11-01");
    await batch.getByRole("button", { name: "Enroll selected students", exact: true }).click();
    await expect(batch.getByRole("status")).toContainText("Saved 2 enrollments");
    const records = await prisma.enrollment.findMany({ where: { schoolId, academicYearId: nextYearId, student: { admissionNumber: { in: admissions } } }, include: { charges: true } });
    expect(records).toHaveLength(2);
    expect(records.map(record => record.rollNumber).sort()).toEqual([`A-${suffix}`, `B-${suffix}`]);
    expect(records.every(record => record.charges.reduce((sum, charge) => sum + charge.amountPaise, 0) === 100000)).toBe(true);
    await page.goto(`/schools/${schoolId}/students/${records[0].studentId}`);
    await expect(page.getByRole("link", { name: "Enroll / promote", exact: true })).toBeVisible();
    await expect(page.getByText("Change student status", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Record payment & issue receipt", exact: true })).toHaveCount(0);
  });

  test("management assigns configured fees individually and in bulk without creating duplicate charges", async ({ page }) => {
    const prefix = `FEES-${randomUUID().slice(0, 12)}`.toUpperCase();
    const admissions = [`${prefix}-A`, `${prefix}-B`];
    await importStudents(users[0], schoolId, importHeaders.join(",") + "\n" + admissions.map(admission => `${admission},Synthetic,2010-05-10,,,,Guardian,+49123456789,0,`).join("\n"));
    const students = await prisma.student.findMany({ where: { schoolId, admissionNumber: { in: admissions } }, orderBy: { admissionNumber: "asc" } });
    // Seed waiting enrollments directly so assignment controls can be tested independently of automatic enrollment assignment.
    for (const student of students) await prisma.enrollment.create({ data: { schoolId, studentId: student.id, academicYearId: nextYearId, classId: nextClassId, startsOn: new Date("2021-11-01"), createdById: users[0].id } });
    await login(page, users[2].email);
    await page.goto(`/schools/${schoolId}/students/${students[0].id}`);
    await page.getByRole("button", { name: "Assign fees: 2021-22 / 6A", exact: true }).click();
    await expect(page.getByRole("article").filter({ hasText: "Total outstanding" })).toContainText("1,000.00");
    await page.goto(`/schools/${schoolId}/operations?${new URLSearchParams({ batchYearId: nextYearId, batchClassId: nextClassId, batchSearch: prefix })}`);
    const batch = page.locator("#bulk-enrollment");
    await batch.getByLabel("Select all shown", { exact: true }).check();
    await batch.getByRole("button", { name: "Assign fees to selected students", exact: true }).click();
    await expect(batch.getByRole("status")).toContainText("Assigned full-year fees to 1 enrollment");
    await page.reload();
    await expect(batch.getByRole("button", { name: "Assign fees to selected students", exact: true })).toBeDisabled();
    const records = await prisma.enrollment.findMany({ where: { schoolId, studentId: { in: students.map(student => student.id) } }, include: { charges: true } });
    expect(records).toHaveLength(2);
    expect(records.every(record => record.charges.length === 1 && record.charges[0].amountPaise === 100000)).toBe(true);
  });

  test("cancelling staff removal sends no action, confirming revokes only school access", async ({ page }) => {
    const name = `SyntheticRevoke${suffix}`;
    const staff = await prisma.user.create({ data: { name, email: `revoke-${suffix}@example.test`, role: "MANAGEMENT", passwordHash: await hashPassword(password), memberships: { create: { schoolId, role: "MANAGEMENT" } } } });
    createdUsers.push(staff.id);
    await login(page);
    await page.goto(`/schools/${schoolId}/settings`);
    const manage = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: `Manage ${name}` }) });
    await manage.locator("summary").click();
    let posts = 0;
    page.on("request", request => { if (request.method() === "POST") posts++; });
    const cancelled = page.waitForEvent("dialog");
    const firstClick = manage.getByRole("button", { name: "Remove school access", exact: true }).click();
    const firstDialog = await cancelled;
    expect(firstDialog.message()).toContain(name);
    expect(firstDialog.message()).toContain("Synthetic Operations UI");
    await firstDialog.dismiss(); await firstClick;
    expect(posts).toBe(0);
    expect((await prisma.schoolMembership.findUniqueOrThrow({ where: { schoolId_userId: { schoolId, userId: staff.id } } })).isActive).toBe(true);
    const confirmed = page.waitForEvent("dialog");
    const secondClick = manage.getByRole("button", { name: "Remove school access", exact: true }).click();
    await (await confirmed).accept(); await secondClick;
    await expect(manage.getByRole("status")).toContainText("School access removed");
    expect((await prisma.schoolMembership.findUniqueOrThrow({ where: { schoolId_userId: { schoolId, userId: staff.id } } })).isActive).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).isActive).toBe(true);
  });
});
