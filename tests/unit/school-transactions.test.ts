import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), membership: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { inSchool } from "../../src/services/school-transactions";

const actor = { id: "synthetic", name: "Synthetic", role: "ADMIN" as const };
const tx = { schoolMembership: { findUnique: mocks.membership } };
const known = (code: string, meta?: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError("Synthetic database failure", { code, clientVersion: "6.19.3", meta });
const connector = (state: string, detail = "") => new Prisma.PrismaClientUnknownRequestError(`ConnectorError(QueryError(PostgresError { code: "${state}", message: "Synthetic database failure", detail: ${detail} }))`, { clientVersion: "6.19.3" });

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0);
  mocks.membership.mockResolvedValue({ role: "ADMIN", isActive: true, canConfigureFees: true });
  mocks.transaction.mockImplementation(async work => work(tx));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("school transaction retries", () => {
  it.each([
    ["Prisma conflict", known("P2034")],
    ["raw serialization failure", known("P2010", { code: "40001" })],
    ["raw deadlock", known("P2010", { code: "40P01" })],
    ["connector serialization failure", connector("40001")],
    ["connector deadlock", connector("40P01")],
  ])("restarts the whole transaction after %s", async (_label, conflict) => {
    const work = vi.fn().mockResolvedValue("saved");
    mocks.transaction.mockImplementationOnce(async callback => { await callback(tx); throw conflict; });
    const assertion = expect(inSchool(actor, "school", "configure", work)).resolves.toBe("saved");
    await vi.runAllTimersAsync(); await assertion;
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable", timeout: 20000 });
  });
  it("backs off before opening another transaction", async () => {
    mocks.transaction.mockRejectedValueOnce(known("P2034"));
    const assertion = expect(inSchool(actor, "school", "view", async () => "saved")).resolves.toBe("saved");
    await vi.advanceTimersByTimeAsync(24);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await assertion;
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
  it("stops after five attempts and preserves the final conflict", async () => {
    const conflict = known("P2034"); mocks.transaction.mockRejectedValue(conflict);
    const assertion = expect(inSchool(actor, "school", "view", async () => "saved")).rejects.toBe(conflict);
    await vi.runAllTimersAsync(); await assertion;
    expect(mocks.transaction).toHaveBeenCalledTimes(5);
  });
  it.each([
    ["unique violation", known("P2002")],
    ["timeout", known("P2028")],
    ["raw constraint failure", known("P2010", { code: "23514" })],
    ["immutable/append-only trigger", connector("P0001")],
    ["SQLSTATE embedded in constraint detail", connector("23514", 'PostgresError { code: "40001" }')],
    ["plain application error", new Error('PostgresError { code: "40001" }')],
  ])("does not retry %s", async (_label, error) => {
    mocks.transaction.mockRejectedValue(error);
    await expect(inSchool(actor, "school", "view", async () => "saved")).rejects.toBe(error);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rechecks authorization when a conflicted transaction restarts", async () => {
    mocks.membership.mockResolvedValueOnce({ role: "ADMIN", canConfigureFees: true }).mockResolvedValueOnce(null);
    mocks.transaction.mockImplementationOnce(async callback => { await callback(tx); throw known("P2034"); });
    const work = vi.fn().mockResolvedValue("saved");
    const assertion = expect(inSchool(actor, "school", "configure", work)).rejects.toThrow("permission");
    await vi.runAllTimersAsync(); await assertion;
    expect(work).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
});
