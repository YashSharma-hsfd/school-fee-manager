import { describe, expect, it } from "vitest";
import { allocateOldest, balances, displayMoney, installments, moneySchema } from "../../src/services/fee-calculations";
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
describe("exact monetary amounts", () => {
  it.each([["0.01", 1], ["12.1", 1210], ["24000", 2400000], ["9999999.99", 999999999], ["10000000", 1000000000]])("parses %s without floating point arithmetic", (value, expected) => expect(moneySchema.parse(value)).toBe(expected));
  it.each(["0", "-1", "1.001", "1e3", "NaN", "Infinity", "1,000", "10000001"])("rejects %s", value => expect(moneySchema.safeParse(value).success).toBe(false));
  it("formats minor units exactly", () => { expect(displayMoney(10001)).toBe("100.01"); expect(displayMoney(1)).toBe("0.01"); });
});
describe("due-date schedules", () => {
  it.each([1, 4, 12])("preserves the annual total across %i installments", count => {
    const result = installments(120001, count, date("2026-04-10"), date("2027-03-31"));
    expect(result).toHaveLength(count);
    expect(result.reduce((sum, item) => sum + item.amountPaise, 0)).toBe(120001);
    expect(Math.max(...result.map(item => item.amountPaise)) - Math.min(...result.map(item => item.amountPaise))).toBeLessThanOrEqual(1);
    expect(result.at(-1)!.dueOn <= date("2027-03-31")).toBe(true);
  });
  it("rejects a schedule extending beyond the year", () => expect(() => installments(120000, 12, date("2026-05-10"), date("2027-03-31"))).toThrow("beyond"));
  it("rejects unsafe amounts and unsupported schedules", () => { expect(() => installments(1.5, 12, date("2026-04-10"), date("2027-03-31"))).toThrow(); expect(() => installments(100, 3, date("2026-04-10"), date("2027-03-31"))).toThrow(); });
});
describe("flexible payments and outstanding balances", () => {
  const charges = [
    { id: "old", amountPaise: 40000, settledPaise: 0, dueOn: date("2025-03-10") },
    { id: "new", amountPaise: 100000, settledPaise: 20000, dueOn: date("2026-05-10") },
    { id: "future", amountPaise: 100000, settledPaise: 0, dueOn: date("2026-09-10") },
  ];
  it("settles previous-year arrears first and partially covers the next charge", () => expect(allocateOldest(50000, [...charges].reverse())).toEqual([{ chargeId: "old", amountPaise: 40000 }, { chargeId: "new", amountPaise: 10000 }]));
  it("keeps overdue separate from future dues", () => expect(balances(charges, date("2026-05-10"))).toEqual({ outstanding: 220000, overdue: 40000, futureAndCurrent: 180000 }));
  it("allows an amount covering several installments", () => expect(allocateOldest(220000, charges).reduce((sum, item) => sum + item.amountPaise, 0)).toBe(220000));
  it("rejects overpayment instead of silently discarding money", () => expect(() => allocateOldest(220001, charges)).toThrow("exceeds"));
  it("rejects zero, negative and fractional payments", () => { for (const amount of [0, -1, 0.1]) expect(() => allocateOldest(amount, charges)).toThrow(); });
});
