export const studentStructureMigration = "20261116090000_finalize_school_database";

/** Decide before starting transactional DDL, so its error cannot hide the cause. */
export function preparationBlocker({ legacyStudents, failedMigrations }) {
  if (legacyStudents > 0) {
    return `${legacyStudents} legacy student record(s) need verified dates of birth and conversion of their guardian/enrollment details. The finalized schema requires DOB. No migration was attempted and no data was changed. Preserve these records for conversion, or explicitly choose to replace disposable test data. Do not reset a database containing records you need.`;
  }
  if (failedMigrations.includes(studentStructureMigration)) {
    return `A previous attempt at ${studentStructureMigration} is marked failed. No migration was attempted. Inspect the failed attempt and confirm its transaction rolled back before marking it rolled back with Prisma; then retry db:prepare. Do not mark it applied or reset the database to hide the failure.`;
  }
  if (failedMigrations.length) {
    return "A previous migration is marked failed. Inspect npx prisma migrate status before retrying. No migration was attempted.";
  }
  return null;
}

export async function inspectPreparation(db) {
  const [tables] = await db.$queryRaw`SELECT
    to_regclass('public."Student"') IS NOT NULL AS "hasStudents",
    to_regclass('public._prisma_migrations') IS NOT NULL AS "hasMigrations",
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Student' AND column_name='dateOfBirth') AS "hasDateOfBirth"`;
  let legacyStudents = 0;
  if (tables.hasStudents && !tables.hasDateOfBirth) {
    const [counts] = await db.$queryRaw`SELECT count(*)::int AS count FROM public."Student"`;
    legacyStudents = counts.count;
  }
  const failures = tables.hasMigrations
    ? await db.$queryRaw`SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`
    : [];
  return { legacyStudents, failedMigrations: failures.map(row => row.migration_name) };
}
