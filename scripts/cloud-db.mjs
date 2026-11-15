import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cloudDatabaseConfig, cloudMigrationEnvironment } from "./cloud-db-config.mjs";

const operation = process.argv[2];
if (!["status", "deploy", "create-staff"].includes(operation)) {
  console.error("Use db:cloud:status, db:cloud:deploy or staff:cloud:create through npm.");
  process.exitCode = 1;
} else {
  try {
    const config = cloudDatabaseConfig(process.env);
    const root = fileURLToPath(new URL("../", import.meta.url));
    const cli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
    console.log(`Cloud migration target: ${config.target}`);
    console.log(operation === "status" ? "Checking committed migration status." : operation === "deploy" ? "Applying committed migrations. No reset, seed or local-data import is performed." : "Provisioning a new staff account in the cloud database; existing accounts are not overwritten.");
    const args = operation === "create-staff"
      ? ["--experimental-strip-types", fileURLToPath(new URL("./create-user.mjs", import.meta.url))]
      : [cli, "migrate", operation, "--schema", "prisma/schema.prisma"];
    const result = spawnSync(process.execPath, args, {
      cwd: root, stdio: "inherit", env: cloudMigrationEnvironment(process.env, config),
    });
    if (result.error) throw new Error("Could not start Prisma migration tooling.");
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cloud database configuration failed.");
    process.exitCode = 1;
  }
}
