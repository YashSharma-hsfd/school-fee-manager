import { describe, expect, it } from "vitest";
import { auditFiltersSchema, auditWhere } from "../../src/services/audit-filters";

describe("audit filters", () => {
  it("uses school-local inclusive dates with an exclusive end boundary", () => {
    expect(auditWhere("school", { auditFrom: "2026-04-01", auditTo: "2026-04-01" })).toEqual({ schoolId: "school", createdAt: { gte: new Date("2026-03-31T18:30:00Z"), lt: new Date("2026-04-01T18:30:00Z") } });
  });
  it("retains school scoping with record, actor and action filters", () => {
    expect(auditWhere("school", { actor: " Example ", action: "PAYMENT_REVERSED", entity: "receipt" })).toMatchObject({ schoolId: "school", actorName: { contains: "Example", mode: "insensitive" }, action: "PAYMENT_REVERSED", entityId: "receipt" });
  });
  it("rejects reversed date ranges", () => {
    expect(auditFiltersSchema.safeParse({ auditFrom: "2026-04-02", auditTo: "2026-04-01" }).success).toBe(false);
  });
});
