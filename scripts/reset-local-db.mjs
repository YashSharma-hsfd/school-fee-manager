import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { localResetTarget, readLocalResetIdentity, assertLocalResetIdentity } from "./local-db-reset-config.mjs";

let db;
let resetStarted = false;
try {
  const url = localResetTarget(process.env.DATABASE_URL, process.env.NODE_ENV);
  db = new PrismaClient({ datasources: { db: { url } }, errorFormat: "minimal" });
  const identity = await readLocalResetIdentity(db);
  assertLocalResetIdentity(identity);
  const [state] = await db.$queryRaw`SELECT to_regclass('public."User"') IS NOT NULL AS "hasUsers",
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='isPlatformAdmin') AS modern`;
  let admin;
  if (state.hasUsers) {
    const active = state.modern ? Prisma.sql`"isActive"` : Prisma.sql`active`;
    const platform = state.modern ? Prisma.sql`AND "isPlatformAdmin" = true` : Prisma.empty;
    // Keep only the existing bootstrap owner's login, in memory; never print/store its password hash.
    [admin] = await db.$queryRaw(Prisma.sql`SELECT id,email,name,"passwordHash","createdAt" FROM "User"
      WHERE role='ADMIN' AND ${active}=true ${platform} ORDER BY "createdAt",id LIMIT 1`);
  }
  await db.$disconnect();
  console.log("Verified reset target: localhost:5432/school_fee_manager (public).");
  console.log("Removing local dummy records and reapplying migrations. Supabase is not accessed.");
  const cli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  resetStarted = true;
  const result = spawnSync(process.execPath, [cli, "migrate", "reset", "--force", "--skip-seed", "--skip-generate"], {
    stdio: "inherit", env: { ...process.env, DATABASE_URL: url },
  });
  if (result.error || result.status !== 0) throw new Error("Reset did not finish. Inspect the Prisma error above before retrying.");
  if (admin) {
    await db.user.create({ data: { ...admin, role: "ADMIN", isActive: true, isPlatformAdmin: true } });
    console.log("Preserved your existing local administrator login.");
  } else {
    console.log("No existing platform administrator to preserve. Create one with staff:create and STAFF_PLATFORM_ADMIN=true.");
  }
  const [counts] = await db.$queryRaw`SELECT (SELECT count(*)::int FROM "Student") AS students,
    (SELECT count(*)::int FROM "School") AS schools, (SELECT count(*)::int FROM "Payment") AS payments,
    (SELECT count(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations`;
  if (counts.students || counts.schools || counts.payments) throw new Error("Unexpected records remain after reset.");
  console.log(`Verified: ${counts.migrations} migrations applied; zero local students, schools and payments.`);
} catch (error) {
  if (error?.code === "P1001" || error?.name === "PrismaClientInitializationError") {
    console.error("Cannot reach local PostgreSQL from this session. No reset was attempted. Run npm run db:local:reset in your own PowerShell.");
  } else {
    console.error(error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Local reset failed. Check database access and migration status.");
    if (!resetStarted) console.error("No reset was attempted.");
  }
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
