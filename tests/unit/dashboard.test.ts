import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), modes: vi.fn(), recent: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.query, payment: { groupBy: mocks.modes, findMany: mocks.recent } } }));
import { schoolDashboard } from "../../src/services/dashboard";

describe("school dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers();
    // Still November 14 in UTC; already November 15 at the school.
    vi.setSystemTime(new Date("2026-11-14T20:00:00Z"));
    mocks.query.mockResolvedValue([{ active: BigInt(3), inactive: BigInt(1), withdrawn: BigInt(1), unassigned: BigInt(1), overdueStudents: BigInt(2), overdue: BigInt(10001), outstanding: BigInt(20001) }]);
    mocks.modes.mockImplementation(async ({ where }) => [{ mode: "CASH", _count: 1, _sum: { amountCents: where.paidOn.gte.toISOString().slice(0, 10) === "2026-11-15" ? 10001 : 50002 } }]);
    mocks.recent.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());
  it("uses school-local today and month boundaries with exact collection totals", async () => {
    const result = await schoolDashboard("school");
    expect(result.today).toBe("2026-11-15");
    expect(result.monthStart).toBe("2026-11-01");
    expect(result.daily.total).toBe(BigInt(10001));
    expect(result.monthly.total).toBe(BigInt(50002));
    expect(mocks.modes).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school", reversedAt: null, paidOn: { gte: new Date("2026-11-15"), lte: new Date("2026-11-15") } } }));
    expect(mocks.modes).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school", reversedAt: null, paidOn: { gte: new Date("2026-11-01"), lte: new Date("2026-11-15") } } }));
  });
  it("limits recent receipts and preserves totals for inactive/withdrawn accounts", async () => {
    const result = await schoolDashboard("school");
    expect(result.summary).toMatchObject({ inactive: BigInt(1), withdrawn: BigInt(1), outstanding: BigInt(20001) });
    expect(mocks.recent).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school", reversedAt: null }, take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });
});
