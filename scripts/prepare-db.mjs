import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { inspectPreparation, preparationBlocker } from "./db-prepare-check.mjs";

const checkOnly = process.argv[2] === "--check";
const db = new PrismaClient({ errorFormat: "minimal" });
let ready = false;
try {
  const state = await inspectPreparation(db);
  const blocker = preparationBlocker(state);
  if (blocker) {
    console.error(blocker);
    process.exitCode = 1;
  } else {
    ready = true;
    console.log("Database preflight passed. No legacy-student or failed-migration blocker detected.");
  }
} catch {
  console.error("Could not inspect the configured database. Check that PostgreSQL is running and DATABASE_URL is correct. No migration was attempted.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

if (ready && !checkOnly) {
  const cli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) process.exitCode = result.status || 1;
  // Generation runs after this process exits: $disconnect does not unload the
  // native query-engine DLL on Windows, so regenerating here would lock itself.
}
