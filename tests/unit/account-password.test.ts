import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), verify: vi.fn(), hash: vi.fn(), update: vi.fn(), revoke: vi.fn(), memberships: vi.fn(), audit: vi.fn(), cookieDelete: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ readSession: mocks.session, sessionCookie: "school-fee-session" }));
vi.mock("@/lib/passwords", () => ({ verifyPassword: mocks.verify, hashPassword: mocks.hash }));
vi.mock("@/services/fees", () => ({ audit: mocks.audit }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.cookieDelete }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: mocks.find },
  $transaction: (work: (tx: unknown) => unknown) => work({ user: { updateMany: mocks.update }, session: { deleteMany: mocks.revoke }, schoolMembership: { findMany: mocks.memberships } }),
} }));
import { changeOwnPassword } from "../../src/actions/account";

const initial = { error: "", success: "" };
function form() {
  const data = new FormData();
  data.set("currentPassword", "Synthetic old password");
  data.set("password", "Synthetic new password");
  data.set("confirmation", "Synthetic new password");
  return data;
}
describe("self-service password change", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ id: "staff", name: "Synthetic Staff", role: "ACCOUNTANT" });
    mocks.find.mockResolvedValue({ id: "staff", active: true, passwordHash: "previous-hash" });
    mocks.verify.mockResolvedValue(true); mocks.hash.mockResolvedValue("replacement-hash");
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.memberships.mockResolvedValue([{ schoolId: "school" }]);
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("requires a current authenticated session", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(changeOwnPassword(initial, form())).rejects.toThrow("redirect");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("requires confirmation and the correct current password", async () => {
    const data = form(); data.set("confirmation", "Different password");
    expect((await changeOwnPassword(initial, data)).error).toContain("must match");
    expect(mocks.find).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValue(false);
    expect((await changeOwnPassword(initial, form())).error).toContain("current password");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a concurrent reset instead of overwriting a newer password", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await changeOwnPassword(initial, form())).error).toContain("Account changed");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "staff", active: true, passwordHash: "previous-hash" }, data: { passwordHash: "replacement-hash" } });
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });
  it("revokes every session and signs out after recording a password-free audit", async () => {
    await expect(changeOwnPassword(initial, form())).rejects.toThrow("redirect");
    expect(mocks.revoke).toHaveBeenCalledWith({ where: { userId: "staff" } });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("school-fee-session");
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "staff" }), "school", "PASSWORD_CHANGED", "staff", {});
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
