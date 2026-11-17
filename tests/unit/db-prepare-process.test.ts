import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";

const mocks = vi.hoisted(() => ({ query: vi.fn(), disconnect: vi.fn(), spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));
vi.mock("@prisma/client", () => ({ PrismaClient: class {
  $queryRaw = mocks.query;
  $disconnect = mocks.disconnect;
} }));
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.argv = [process.execPath, "scripts/prepare-db.mjs"];
  process.exitCode = undefined;
  mocks.query.mockResolvedValue([{ hasStudents: false, hasMigrations: false, hasDateOfBirth: false }]);
  mocks.spawn.mockReturnValue({ status: 0 });
});
afterEach(() => {
  process.argv = originalArgv; process.exitCode = originalExitCode; vi.restoreAllMocks();
});

describe("Windows Prisma generation process boundary", () => {
  it("never regenerates Client from the process that loaded its native engine", async () => {
    await import("../../scripts/prepare-db.mjs");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.spawn).toHaveBeenCalledExactlyOnceWith(process.execPath,
      [expect.any(String), "migrate", "deploy"], expect.objectContaining({ stdio: "inherit" }));
    const [prepare, generate] = packageJson.scripts["db:prepare"].split("&&").map(part => part.trim());
    expect(prepare).toMatch(/scripts\/prepare-db\.mjs$/);
    expect(generate).toBe("prisma generate");
  });
  it("keeps the diagnostic command read-only", async () => {
    process.argv.push("--check");
    await import("../../scripts/prepare-db.mjs");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
