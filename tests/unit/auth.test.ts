import { describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/passwords";
import { authenticate, resolveSession, sessionLifetime, staffHome, tokenHash } from "../../src/services/auth";

const now = new Date("2026-11-13T12:00:00Z");
const user = { id: "synthetic-user", name: "Example Staff", role: "ADMIN" as const, isActive: true };
const credentials = { email: " staff@example.test ", password: "Synthetic password 123" };

describe("staff credentials", () => {
  it("salts hashes and rejects incorrect passwords and malformed hashes", async () => {
    const hash = await hashPassword(credentials.password);
    expect(hash).not.toBe(await hashPassword(credentials.password));
    expect(await verifyPassword(credentials.password, hash)).toBe(true);
    expect(await verifyPassword("incorrect", hash)).toBe(false);
    expect(await verifyPassword("incorrect", "invalid")).toBe(false);
  });
  it("validates before accessing storage", async () => {
    const dependencies = { consumeAttempt: vi.fn(), findUser: vi.fn(), saveSession: vi.fn() };
    expect(await authenticate({}, dependencies)).toBeNull();
    expect(dependencies.consumeAttempt).not.toHaveBeenCalled();
  });
  it("stops throttled requests before password checking", async () => {
    const dependencies = { consumeAttempt: vi.fn().mockResolvedValue(false), findUser: vi.fn(), saveSession: vi.fn() };
    expect(await authenticate(credentials, dependencies)).toBeNull();
    expect(dependencies.findUser).not.toHaveBeenCalled();
    expect(dependencies.saveSession).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "ACCOUNTANT"] as const)("issues a hashed expiring session for %s", async role => {
    const dependencies = {
      consumeAttempt: vi.fn().mockResolvedValue(true),
      findUser: vi.fn().mockResolvedValue({ ...user, role, passwordHash: await hashPassword(credentials.password) }),
      saveSession: vi.fn(),
    };
    const result = await authenticate(credentials, dependencies, now);
    expect(result?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(dependencies.findUser).toHaveBeenCalledWith("staff@example.test");
    expect(dependencies.saveSession).toHaveBeenCalledWith({ tokenHash: tokenHash(result!.token), userId: user.id, expiresAt: new Date(now.getTime() + sessionLifetime) });
  });
  it.each(["unknown", "inactive", "incorrect"])("rejects %s credentials without issuing a session", async scenario => {
    const dependencies = {
      consumeAttempt: vi.fn().mockResolvedValue(true),
      findUser: vi.fn().mockResolvedValue(scenario === "unknown" ? null : { ...user, isActive: scenario !== "inactive", passwordHash: await hashPassword(scenario === "incorrect" ? "Other password" : credentials.password) }),
      saveSession: vi.fn(),
    };
    expect(await authenticate(credentials, dependencies)).toBeNull();
    expect(dependencies.saveSession).not.toHaveBeenCalled();
  });
});

describe("session authorization", () => {
  const token = "a".repeat(64);
  it("rejects malformed tokens before querying storage", async () => {
    const find = vi.fn();
    expect(await resolveSession("forged", find)).toBeNull();
    expect(await resolveSession(undefined, find)).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });
  it("rejects missing, expired, and disabled sessions", async () => {
    for (const session of [null, { expiresAt: now, user }, { expiresAt: new Date(now.getTime() + 1000), user: { ...user, isActive: false } }]) {
      expect(await resolveSession(token, async () => session, now)).toBeNull();
    }
  });
  it("returns the current database role and only safe identity fields", async () => {
    const find = vi.fn().mockResolvedValue({ expiresAt: new Date(now.getTime() + 1000), user: { ...user, role: "ACCOUNTANT", passwordHash: "private" } });
    expect(await resolveSession(token, find, now)).toEqual({ id: user.id, name: user.name, role: "ACCOUNTANT" });
    expect(find).toHaveBeenCalledWith(tokenHash(token));
    expect(staffHome("ACCOUNTANT")).toBe("/accountant");
    expect(staffHome("ADMIN")).toBe("/admin/dashboard");
  });
});
