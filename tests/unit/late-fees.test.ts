import { describe, expect, it } from "vitest";
import { addDays, calculateLateFees, localDay, type LateFeePrincipal, type LateFeeRate } from "../../src/services/late-fee-calculations";
import { lateFeeAmountSchema } from "../../src/services/late-fees";

const principal = (dueOn: string, settlements: LateFeePrincipal["settlements"] = []): LateFeePrincipal => ({ dueOn, amountPaise: 100000, settlements });
const policy = (amountPaise = 10000, effectiveFrom = "2026-01-01", intervalMonths = 1): LateFeeRate => ({ amountPaise, effectiveFrom, intervalMonths });
function calculate(asOf: string, principals = [principal("2026-01-01"), principal("2026-02-01"), principal("2026-03-01")], policies = [policy()], eligibleFrom = "2026-01-01") {
  return calculateLateFees({ asOf, eligibleFrom, principals, policies });
}
const total = (rows: ReturnType<typeof calculate>) => rows.reduce((sum, row) => sum + row.amountPaise, 0);

describe("recurring late-fee calculation", () => {
  it("allows the full 15-day grace period and charges on the following day", () => {
    expect(calculate("2026-01-16")).toEqual([]);
    expect(calculate("2026-01-17")).toEqual([{ forDueOn: "2026-01-01", cycleOn: "2026-01-01", dueOn: "2026-01-17", amountPaise: 10000 }]);
  });
  it("matches 100, 300 and 600 for one, two and three missed monthly cycles", () => {
    expect(total(calculate("2026-01-17"))).toBe(10000);
    expect(total(calculate("2026-02-17"))).toBe(30000);
    expect(total(calculate("2026-03-17"))).toBe(60000);
  });
  it("charges once for multiple components sharing the same installment due date", () => {
    expect(total(calculate("2026-01-17", [principal("2026-01-01"), principal("2026-01-01")]))).toBe(10000);
  });
  it("does not penalize a fully paid or discounted installment; a partial balance incurs the flat penalty", () => {
    const full = { amountPaise: 100000, on: "2026-01-16", reversedOn: null };
    expect(calculate("2026-03-17", [principal("2026-01-01", [full])])).toEqual([]);
    expect(total(calculate("2026-01-17", [principal("2026-01-01", [{ ...full, amountPaise: 50000 }])]))).toBe(10000);
  });
  it("retains the first penalty when principal is paid after grace but stops further cycles", () => {
    const paid = { amountPaise: 100000, on: "2026-01-17", reversedOn: null };
    expect(total(calculate("2026-04-17", [principal("2026-01-01", [paid])]))).toBe(10000);
  });
  it("uses payment dates, and restores eligibility only after a reversal actually occurred", () => {
    const reversed = { amountPaise: 100000, on: "2026-01-10", reversedOn: "2026-02-10" };
    const rows = calculate("2026-02-17", [principal("2026-01-01", [reversed])]);
    expect(rows).toEqual([{ forDueOn: "2026-01-01", cycleOn: "2026-02-01", dueOn: "2026-02-17", amountPaise: 10000 }]);
  });
  it("supports quarterly cycles and annual recurrence after the academic year ends", () => {
    expect(total(calculate("2026-04-17", [principal("2026-01-01"), principal("2026-04-01")], [policy(10000, "2026-01-01", 3)]))).toBe(30000);
    expect(total(calculate("2027-01-17", [principal("2026-01-01")], [policy(10000, "2026-01-01", 12)]))).toBe(20000);
  });
  it("clamps month-end anniversaries without drifting after February", () => {
    const rows = calculate("2026-04-16", [principal("2026-01-31")]);
    expect(rows.map(row => row.cycleOn)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(rows.map(row => row.dueOn)).toEqual(["2026-02-16", "2026-03-16", "2026-04-16"]);
  });
  it("applies rate versions prospectively, including a zero rate to disable future cycles", () => {
    const rates = [policy(), policy(20000, "2026-02-01"), policy(0, "2026-03-01")];
    expect(total(calculate("2026-04-17", undefined, rates))).toBe(50000);
  });
  it("uses the latest saved version when two changes share the same effective date", () => {
    expect(total(calculate("2026-02-17", undefined, [policy(), policy(20000, "2026-02-01"), policy(30000, "2026-02-01")]))).toBe(70000);
  });
  it("validates rupee inputs without floating-point monetary calculations", () => {
    expect(lateFeeAmountSchema.parse(undefined)).toBe(0);
    expect(lateFeeAmountSchema.parse("")).toBe(0);
    expect(lateFeeAmountSchema.parse("0.00")).toBe(0);
    expect(lateFeeAmountSchema.parse("100.01")).toBe(10001);
    expect(() => lateFeeAmountSchema.parse("-1")).toThrow();
    expect(() => lateFeeAmountSchema.parse("1.001")).toThrow();
  });
  it("does not backfill cycles before policy activation or enrollment eligibility", () => {
    expect(total(calculate("2026-02-17", undefined, [policy(10000, "2026-02-01")]))).toBe(20000);
    expect(total(calculate("2026-02-17", undefined, [policy()], "2026-02-02"))).toBe(20000);
    expect(calculate("2026-02-17", undefined, [])).toEqual([]);
  });
  it("rejects invalid amounts and schedule changes within the same fee plan", () => {
    expect(() => calculate("2026-03-17", undefined, [policy(-1)])).toThrow("Invalid late-fee policy");
    expect(() => calculate("2026-03-17", undefined, [policy(), policy(10000, "2026-02-01", 3)])).toThrow("frequency cannot change");
  });
  it("uses the school timezone at midnight and handles leap-day grace dates", () => {
    expect(localDay(new Date("2026-01-16T18:30:00Z"))).toBe("2026-01-17");
    expect(addDays("2028-02-14", 15)).toBe("2028-02-29");
  });
});
