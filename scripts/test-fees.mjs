import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env before running database tests.");
const source = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("This runner only creates test databases on local PostgreSQL.");
const name = `school_fee_test_${randomBytes(8).toString("hex")}`;
const adminUrl = new URL(source); adminUrl.pathname = "/postgres";
const testUrl = new URL(source); testUrl.pathname = `/${name}`;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
let created = false;
let browserServer;
function run(file, args, extra = {}) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", timeout: 240_000, env: { ...process.env, DATABASE_URL: testUrl.toString(), ...extra } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Verification failed (exit ${result.status}).`);
}
try {
  // The identifier is generated here, contains only a fixed prefix and hex, and never comes from user input.
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created = true;
  console.log("Created an isolated temporary PostgreSQL test database.");
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  run("node_modules/prisma/build/index.js", ["db", "execute", "--file", "tests/sql/finalized-schema.sql", "--schema", "prisma/schema.prisma"]);
  // Fixture cleanup temporarily alters shared table triggers; suites must not overlap it.
  run("node_modules/vitest/vitest.mjs", ["run", "--no-file-parallelism"], { FEES_E2E: "1" });
  if (process.env.RUN_BROWSER_TESTS === "1") {
    const port = process.env.PLAYWRIGHT_TEST_PORT || "3100";
    if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid browser test port");
    const external = process.env.PLAYWRIGHT_DEV_WEBPACK !== "1";
    if (external) {
      // Own the Node process directly: npm/cmd wrappers can hang Playwright teardown on Windows.
      browserServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], { stdio: "inherit", windowsHide: true, env: { ...process.env, DATABASE_URL: testUrl.toString() } });
      let startupError;
      browserServer.on("error", error => { startupError = error; });
      const deadline = Date.now() + 30_000;
      for (;;) {
        if (startupError) throw startupError;
        if (browserServer.exitCode !== null) throw new Error("Browser test server exited before becoming ready");
        try { if ((await fetch(`http://localhost:${port}/login`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* Wait for this runner's server. */ }
        if (Date.now() > deadline) throw new Error("Browser test server did not become ready");
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    run("node_modules/@playwright/test/cli.js", ["test", "--workers=1", "--global-timeout=180000", ...(process.env.PLAYWRIGHT_TEST_GREP ? ["--grep", process.env.PLAYWRIGHT_TEST_GREP] : [])], { AUTH_E2E: "1", FEES_E2E: "1", CI: "1", PLAYWRIGHT_EXTERNAL_SERVER: external ? "1" : "0", PLAYWRIGHT_TEST_PORT: port });
  }
} finally {
  if (browserServer && browserServer.exitCode === null) {
    browserServer.kill();
    await new Promise(resolve => { browserServer.once("exit", resolve); setTimeout(resolve, 3000).unref(); });
  }
  if (created && /^school_fee_test_[a-f0-9]{16}$/.test(name)) {
    await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log("Removed the temporary test database.");
  }
  await admin.$disconnect();
}
