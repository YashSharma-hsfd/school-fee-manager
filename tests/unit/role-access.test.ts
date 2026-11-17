import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), get: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { session: { findUnique: mocks.findUnique } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { requireRole } from "../../src/lib/auth";

describe("server role guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("redirects anonymous visitors before querying the database", async () => {
    await expect(requireRole("ADMIN")).rejects.toThrow("redirect:/login");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "ACCOUNTANT"] as const)("permits the matching %s role", async role => {
    mocks.get.mockReturnValue({ value: "a".repeat(64) });
    mocks.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: { id: "synthetic", name: "Example", role, isActive: true } });
    await expect(requireRole(role)).resolves.toEqual({ id: "synthetic", name: "Example", role });
  });
  it.each([
    ["ACCOUNTANT", "ADMIN", "/accountant"],
    ["ADMIN", "ACCOUNTANT", "/admin/dashboard"],
  ] as const)("redirects %s away from %s pages", async (role, requested, home) => {
    mocks.get.mockReturnValue({ value: "a".repeat(64) });
    mocks.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: { id: "synthetic", name: "Example", role, isActive: true } });
    await expect(requireRole(requested)).rejects.toThrow(`redirect:${home}`);
  });
});
