import { test, expect } from "@playwright/test";
test("opens the placeholder dashboard", async ({ page }) => { await page.goto("/"); await expect(page).toHaveURL(/\/admin\/dashboard$/); await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Setup coming soon" })).toBeDisabled(); });

