import { test, expect } from "@playwright/test";

test("visitors are sent to staff sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
});

for (const path of ["/admin/dashboard", "/admin/students", "/accountant", "/schools", "/schools/forged-school", "/schools/forged-school/reports"]) {
  test(`blocks unauthenticated access to ${path}`, async ({ page, context }) => {
    await context.addCookies([{ name: "school-fee-session", value: "forged", domain: "localhost", path: "/" }]);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  });
}
