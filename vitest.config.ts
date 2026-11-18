import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Cleanup changes table-wide triggers. Keep files separate, while preserving Promise.all tests within each file.
    fileParallelism: process.env.FEES_E2E !== "1",
    globalSetup: process.env.FEES_E2E === "1" ? ["./tests/helpers/verify-test-database.ts"] : [],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

