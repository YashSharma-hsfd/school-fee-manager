import { describe, expect, it, vi } from "vitest";
import { inspectPreparation, preparationBlocker, studentStructureMigration } from "../../scripts/db-prepare-check.mjs";

describe("database preparation safeguards", () => {
  it("reports legacy records before Prisma can mask the error with an aborted transaction", () => {
    const result = preparationBlocker({ legacyStudents: 50, failedMigrations: [studentStructureMigration] });
    expect(result).toContain("50 legacy student");
    expect(result).toContain("verified dates of birth");
    expect(result).not.toContain("--applied");
  });
  it("does not mistake a failed attempt for an applied migration", () => {
    expect(preparationBlocker({ legacyStudents: 0, failedMigrations: [studentStructureMigration] })).toContain("confirm its transaction rolled back");
  });
  it("allows a fresh or already-upgraded database, while blocking other migration failures", () => {
    expect(preparationBlocker({ legacyStudents: 0, failedMigrations: [] })).toBeNull();
    expect(preparationBlocker({ legacyStudents: 0, failedMigrations: ["other_migration"] })).toContain("marked failed");
  });
  it("does not query tables that do not exist on a fresh database", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ hasStudents: false, hasMigrations: false, hasDateOfBirth: false }]);
    await expect(inspectPreparation({ $queryRaw: query })).resolves.toEqual({ legacyStudents: 0, failedMigrations: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not treat existing upgraded students as legacy records", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ hasStudents: true, hasMigrations: true, hasDateOfBirth: true }]).mockResolvedValueOnce([]);
    await expect(inspectPreparation({ $queryRaw: query })).resolves.toEqual({ legacyStudents: 0, failedMigrations: [] });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
