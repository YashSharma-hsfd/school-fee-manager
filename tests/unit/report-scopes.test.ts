import { describe, expect, it } from "vitest";
import { reportFiltersSchema, studentWhere, studentSqlWhere, paymentWhere, balanceSqlFilter, csv, decimalMoney } from "../../src/services/report-filters";
import { transactionQuery } from "../../src/services/transaction-report";

describe("report filter consistency", () => {
  it("separates lifecycle, fee status and payment mode while sharing literal search/class filters", () => {
    const f=reportFiltersSchema.parse({ q: " Demo ", className: "5A", lifecycle: "WITHDRAWN", mode: "UPI", from: "2026-04-01", to: "2026-04-02" });
    expect(studentWhere(f)).toMatchObject({ status: "WITHDRAWN", enrollments: { some: { schoolClass: { name: "5A" } } }, OR: expect.arrayContaining([{ guardians: { some: { guardian: { OR: expect.arrayContaining([{ phone: { contains: "Demo", mode: "insensitive" } }]) } } } }]) });
    expect(paymentWhere("school",f)).toMatchObject({ schoolId: "school", mode: "UPI", reversedAt: null, student: { schoolId: "school", status: "WITHDRAWN", enrollments: { some: { schoolClass: { name: "5A" } } } }, paidOn: { gte: new Date("2026-04-01"), lte: new Date("2026-04-02") } });
    const sql=studentSqlWhere("school", { q: "%_", className: "5A" });
    expect(sql.text).toContain("strpos"); expect(sql.text).not.toContain("%_"); expect(sql.values).toContain("%_");
  });
  it("rejects invalid modes/lifecycle/date ranges and offers distinct unassigned/outstanding filters", () => {
    expect(reportFiltersSchema.safeParse({ mode: "FAKE" }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ lifecycle: "overdue" }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ from: "2026-05-02", to: "2026-05-01" }).success).toBe(false);
    expect(balanceSqlFilter("unassigned").text).toContain('"feesNotConfigured"');
    expect(balanceSqlFilter("outstanding").text).toContain('remaining > 0');
  });
  it("includes both reversal types with school-local activity dates and stable pagination", () => {
    const sql=transactionQuery("school",{ q:"Demo",className:"5A",mode:"CASH",from:"2026-04-01" },2);
    expect(sql.text).toContain("PAYMENT_REVERSAL"); expect(sql.text).toContain("DISCOUNT_REVERSAL");
    expect(sql.text).toContain('-p."amountPaise"'); expect(sql.text).toContain('-d."amountPaise"');
    expect(sql.text).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(sql.values).toContain("CASH"); expect(sql.values).toContain("2026-04-01"); expect(sql.values.at(-1)).toBe(50);
    expect(transactionQuery("school",{}).text).not.toContain("LIMIT 51");
  });
  it("exports negative reversal changes as numeric values while blocking spreadsheet formulas", () => {
    expect(decimalMoney(-200001)).toBe("-2000.01"); expect(decimalMoney(-1)).toBe("-0.01");
    expect(csv([[decimalMoney(-200001), "-CMD()", "=HYPERLINK()"]])).toBe('\uFEFF"-2000.01","\'-CMD()","\'=HYPERLINK()"');
  });
});
