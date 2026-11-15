import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), membership: vi.fn(), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/auth", () => ({ readSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { schoolMembership: { findUnique: mocks.membership } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
import { schoolAccess } from "../../src/lib/school";

describe("school page guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ id: "staff", role: "ACCOUNTANT" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    mocks.notFound.mockImplementation(() => { throw new Error("not found"); });
  });
  it("redirects anonymous users before querying membership", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(schoolAccess("school")).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.membership).not.toHaveBeenCalled();
  });
  it("returns not-found for other schools and forbidden operations", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(schoolAccess("school")).rejects.toThrow("not found");
    mocks.membership.mockResolvedValue({ role: "ACCOUNTANT", configureFees: false, manageAccess: false });
    await expect(schoolAccess("school", "students")).rejects.toThrow("not found");
  });
  it("uses the signed-in identity and explicit school grants", async () => {
    mocks.membership.mockResolvedValue({ role: "ACCOUNTANT", configureFees: true, school: { id: "school" } });
    expect((await schoolAccess("school", "configure")).school.id).toBe("school");
    expect(mocks.membership).toHaveBeenCalledWith({ where: { schoolId_userId: { schoolId: "school", userId: "staff" } }, include: { school: true } });
  });
});
