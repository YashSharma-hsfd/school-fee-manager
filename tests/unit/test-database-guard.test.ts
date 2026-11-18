import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), disconnect: vi.fn() }));
vi.mock("@prisma/client", () => ({ PrismaClient: class { $queryRaw = mocks.query; $disconnect = mocks.disconnect; } }));
import verifyTestDatabase from "../helpers/verify-test-database";

beforeEach(() => vi.resetAllMocks());
describe("database test startup guard", () => {
  it("permits a generated disposable database and closes the probe connection", async () => {
    mocks.query.mockResolvedValue([{ name: "school_fee_test_0123456789abcdef" }]);
    await expect(verifyTestDatabase()).resolves.toBeUndefined();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
  it.each(["school_fee_manager", "postgres", "pilot", "school_fee_test_not-generated"])("rejects %s before test files can write fixtures", async name => {
    mocks.query.mockResolvedValue([{ name }]);
    await expect(verifyTestDatabase()).rejects.toThrow("npm run test:integration");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
  it("closes its connection if the database probe fails", async () => {
    mocks.query.mockRejectedValue(new Error("Synthetic connection failure"));
    await expect(verifyTestDatabase()).rejects.toThrow("connection failure");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
});
