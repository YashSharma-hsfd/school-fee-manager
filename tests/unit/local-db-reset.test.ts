import { describe, expect, it, vi } from "vitest";
import { localResetTarget, readLocalResetIdentity, assertLocalResetIdentity } from "../../scripts/local-db-reset-config.mjs";

const local = "postgresql://test:synthetic@localhost:5432/school_fee_manager?schema=public";
describe("local dummy-data reset boundary", () => {
  it("accepts only the approved local target", () => {
    expect(localResetTarget(local)).toBe(local);
    expect(localResetTarget(local.replace("localhost", "127.0.0.1"))).toContain("127.0.0.1");
  });
  it.each([
    local.replace("localhost", "db.example.supabase.co"),
    local.replace("localhost", "localhost.example.com"),
    local.replace("school_fee_manager?", "postgres?"),
    local.replace("5432", "55432"),
    local.replace("public", "private"),
    local + "&host=db.example.supabase.co", local + "&schema=private", "invalid",
  ])("refuses other databases and target overrides", value => {
    expect(() => localResetTarget(value)).toThrow();
  });
  it("refuses production without leaking credentials in the error", () => {
    expect(() => localResetTarget(local, "production")).toThrow("disabled in production");
    try { localResetTarget(local.replace("localhost", "remote.example")); } catch (error) {
      expect((error as Error).message).not.toContain("synthetic");
    }
  });
  it("checks the database actually connected to, not just its URL", () => {
    expect(() => assertLocalResetIdentity({ database: "school_fee_manager", schema: "public", address: "127.0.0.1" })).not.toThrow();
    for (const identity of [
      { database: "postgres", schema: "public", address: "127.0.0.1" },
      { database: "school_fee_manager", schema: "public", address: "10.0.0.1" },
      { database: "school_fee_manager", schema: "private", address: "127.0.0.1" },
    ]) expect(() => assertLocalResetIdentity(identity)).toThrow();
  });
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts the normalized loopback identity %s", address => {
    expect(() => assertLocalResetIdentity({ database: "school_fee_manager", schema: "public", address })).not.toThrow();
  });
  it("reads the host address without PostgreSQL's inet netmask suffix", async () => {
    const identity = { database: "school_fee_manager", schema: "public", address: "::1" };
    const query = vi.fn().mockResolvedValue([identity]);
    expect(await readLocalResetIdentity({ $queryRaw: query })).toEqual(identity);
    const sql = query.mock.calls[0][0].join("");
    expect(sql).toContain("host(inet_server_addr())");
    expect(sql).not.toContain("inet_server_addr()::text");
  });
  it("identifies which target condition failed", () => {
    expect(() => assertLocalResetIdentity({ database: "other", schema: "public", address: "127.0.0.1" })).toThrow("database name");
    expect(() => assertLocalResetIdentity({ database: "school_fee_manager", schema: "private", address: "127.0.0.1" })).toThrow("schema");
    expect(() => assertLocalResetIdentity({ database: "school_fee_manager", schema: "public", address: "10.0.0.1" })).toThrow("not loopback");
  });
});
