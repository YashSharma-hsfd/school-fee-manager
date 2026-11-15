import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, verify } = vi.hoisted(() => ({
  verify: vi.fn(),
  tx: {
    schoolMembership: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() }, loginAttempt: { deleteMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (work: (client: unknown) => unknown) => work(tx) } }));
vi.mock("@/lib/passwords", () => ({ hashPassword: async () => "synthetic-hash", verifyPassword: verify }));
import { createStaff, recoverStaffPassword, revokeStaffAccess } from "../../src/services/staff";

const actor = { id: "admin", name: "Example Admin", role: "ADMIN" as const };
const create = { name: "Example Staff", email: "staff@example.test", role: "ACCOUNTANT", password: "Synthetic password 123", currentPassword: "Current synthetic password" };
const recovery = { ...create, userId: "staff", reason: "Identity verified in person" };

describe("staff account security", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    verify.mockResolvedValue(true);
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", manageAccess: true });
    tx.user.findUnique.mockImplementation(async ({ where }) => where.id === actor.id
      ? { id: actor.id, active: true, role: "ADMIN", passwordHash: "existing-hash" }
      : where.id === "staff" ? { id: "staff", email: create.email, role: "ACCOUNTANT", active: true, memberships: [{ schoolId: "school" }] } : null);
    tx.schoolMembership.findMany.mockResolvedValue([{ schoolId: "school" }]);
    tx.user.create.mockResolvedValue({ id: "staff" });
  });
  it("requires both school access management and a current global administrator", async () => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", manageAccess: false });
    await expect(createStaff(actor, "school", create)).rejects.toThrow("permission");
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ACCOUNTANT", manageAccess: true });
    tx.user.findUnique.mockResolvedValue({ active: true, role: "ACCOUNTANT" });
    await expect(createStaff(actor, "school", create)).rejects.toThrow("permission");
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("requires reauthentication and never overwrites an existing account", async () => {
    verify.mockResolvedValue(false);
    await expect(createStaff(actor, "school", create)).rejects.toThrow("current password");
    verify.mockResolvedValue(true);
    tx.user.findUnique.mockResolvedValue({ id: actor.id, active: true, role: "ADMIN", passwordHash: "existing-hash" });
    await expect(createStaff(actor, "school", create)).rejects.toThrow("already exists");
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("creates school membership and audits without passwords", async () => {
    await expect(createStaff(actor, "school", create)).resolves.toBe("staff");
    expect(tx.user.create).toHaveBeenCalledWith({ data: { name: create.name, email: create.email, role: "ACCOUNTANT", passwordHash: "synthetic-hash", memberships: { create: { schoolId: "school", role: "ACCOUNTANT" } } } });
    expect(JSON.stringify(tx.auditEvent.create.mock.calls)).not.toContain("password");
    expect(JSON.stringify(tx.auditEvent.create.mock.calls)).not.toContain("synthetic-hash");
  });
  it("blocks recovery of accounts shared with unmanaged schools", async () => {
    tx.schoolMembership.findMany.mockResolvedValue([]);
    await expect(recoverStaffPassword(actor, "school", recovery)).rejects.toThrow("schools you do not manage");
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });
  it("blocks recovery of global administrators and accounts outside this school", async () => {
    tx.user.findUnique.mockImplementation(async ({ where }) => where.id === actor.id ? { active: true, role: "ADMIN", passwordHash: "old" } : { id: "staff", active: true, role: "ADMIN", memberships: [{ schoolId: "school" }] });
    await expect(recoverStaffPassword(actor, "school", recovery)).rejects.toThrow("non-administrator");
    tx.user.findUnique.mockImplementation(async ({ where }) => where.id === actor.id ? { active: true, role: "ADMIN", passwordHash: "old" } : { id: "staff", active: true, role: "ACCOUNTANT", memberships: [{ schoolId: "other" }] });
    await expect(recoverStaffPassword(actor, "school", recovery)).rejects.toThrow("in this school");
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it("revokes existing sessions on password recovery and prevents self-removal", async () => {
    await recoverStaffPassword(actor, "school", recovery);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff" } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "staff" }, data: { passwordHash: "synthetic-hash" } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "STAFF_PASSWORD_RECOVERED", details: { reason: recovery.reason } }) });
    await expect(revokeStaffAccess(actor, "school", actor.id)).rejects.toThrow("own school access");
    expect(tx.schoolMembership.delete).not.toHaveBeenCalled();
  });
});
