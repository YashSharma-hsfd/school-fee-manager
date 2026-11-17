import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => ({ tx: {
  schoolMembership: { findUnique: vi.fn() },
  studentCharge: { findFirst: vi.fn(), update: vi.fn() },
  discount: { findFirst: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (work: (client: unknown) => unknown) => work(tx) } }));
import { correctCharge, reverseDiscount } from "../../src/services/fees";

const actor = { id: "actor", name: "Example", role: "ADMIN" as const };
const input = { chargeId: "charge", amount: "80.00", dueOn: "2026-04-10", expectedAmount: "10000", expectedDueOn: "2026-04-01", reason: "Synthetic correction" };
describe("charge corrections and discount reversals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", canConfigureFees: true });
    tx.studentCharge.findFirst.mockResolvedValue({ id: "charge", amountPaise: 10000, dueOn: new Date("2026-04-01"), allocations: [{ amountPaise: 3000 }], credits: [{ amountPaise: 1000 }] });
  });
  it("denies corrections without the configuration grant", async () => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", canConfigureFees: false });
    await expect(correctCharge(actor, "school", input)).rejects.toThrow("permission");
    expect(tx.studentCharge.update).not.toHaveBeenCalled();
  });
  it("rejects stale forms and reductions below settled amounts", async () => {
    await expect(correctCharge(actor, "school", { ...input, expectedAmount: "9000" })).rejects.toThrow("changed");
    await expect(correctCharge(actor, "school", { ...input, amount: "39.99" })).rejects.toThrow("active payments");
    expect(tx.studentCharge.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it("audits before/after and makes retries of the same correction harmless", async () => {
    await correctCharge(actor, "school", input);
    expect(tx.studentCharge.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school", id: "charge" } }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "CHARGE_CORRECTED", details: { before: { amountPaise: 10000, dueOn: "2026-04-01" }, after: { amountPaise: 8000, dueOn: "2026-04-10" }, reason: input.reason } }) });
    vi.clearAllMocks();
    tx.studentCharge.findFirst.mockResolvedValue({ id: "charge", amountPaise: 8000, dueOn: new Date("2026-04-10"), allocations: [], credits: [] });
    await correctCharge(actor, "school", input);
    expect(tx.studentCharge.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it("keeps discount history, rejects outsiders and deduplicates reversals", async () => {
    tx.schoolMembership.findUnique.mockResolvedValue(null);
    await expect(reverseDiscount(actor, "other-school", { discountId: "discount", reason: "Correction" })).rejects.toThrow("permission");
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ACCOUNTANT" });
    tx.discount.findFirst.mockResolvedValue({ id: "discount", amountPaise: 1000, studentId: "student", reversedAt: null });
    await reverseDiscount(actor, "school", { discountId: "discount", reason: "Correction" });
    expect(tx.discount.update).toHaveBeenCalledWith({ where: { id: "discount" }, data: { reversedAt: expect.any(Date), reversedById: actor.id, reversalReason: "Correction" } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "DISCOUNT_REVERSED" }) });
    vi.clearAllMocks();
    tx.discount.findFirst.mockResolvedValue({ id: "discount", reversedAt: new Date() });
    await reverseDiscount(actor, "school", { discountId: "discount", reason: "Correction" });
    expect(tx.discount.update).not.toHaveBeenCalled();
  });
});
