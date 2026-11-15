import { describe, expect, it } from "vitest";
import { csv, decimalMoney, reportFiltersSchema } from "../../src/services/report-filters";

describe("report exports", () => {
  it("rejects impossible and reversed dates and accepts inclusive single days", () => {
    expect(reportFiltersSchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ from: "2026-04-02", to: "2026-04-01" }).success).toBe(false);
    expect(reportFiltersSchema.parse({ from: "2026-04-01", to: "2026-04-01" }).from).toBe("2026-04-01");
  });
  it("escapes CSV text, preserves lines and neutralizes spreadsheet formulas", () => {
    expect(csv([['A,"B"\nC', "=1+1", " \t@SUM(A1)"]])).toBe('\uFEFF"A,""B""\nC","\'=1+1","\' \t@SUM(A1)"');
  });
  it("formats money without precision loss", () => {
    expect(decimalMoney(BigInt("9007199254740993"))).toBe("90071992547409.93");
    expect(decimalMoney(1)).toBe("0.01");
  });
});
