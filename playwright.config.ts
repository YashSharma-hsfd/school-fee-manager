import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_TEST_PORT || "3000");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid Playwright test port");
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  expect: { timeout: 15_000 },
  testDir: "./tests/e2e",
  use: { baseURL, actionTimeout: 15_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
  webServer: {
    command: process.env.PLAYWRIGHT_DEV_WEBPACK === "1" ? `node node_modules/next/dist/bin/next dev --webpack --port ${port}` : process.env.CI || process.env.PLAYWRIGHT_USE_BUILD ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

