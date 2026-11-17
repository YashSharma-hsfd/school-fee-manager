import { describe, expect, it } from "vitest";
import { cloudDatabaseConfig, cloudMigrationEnvironment } from "../../scripts/cloud-db-config.mjs";

const runtime = "postgresql://app.abcdefghijklmnopqrst:synthetic%21@aws-0-ap-south-1.pooler.supabase.com:6543/pilot?sslmode=require&pgbouncer=true";
const direct = "postgresql://owner:synthetic%21@db.abcdefghijklmnopqrst.supabase.co:5432/pilot?sslmode=require";
describe("isolated cloud pilot commands", () => {
  it("keeps the runtime pooled and migrations direct, allowing separate credentials", () => {
    const config = cloudDatabaseConfig({ CLOUD_PROJECT_REF: "abcdefghijklmnopqrst", CLOUD_DATABASE_URL: runtime, CLOUD_DIRECT_URL: direct });
    expect(config.runtimeUrl).toBe(runtime); expect(config.directUrl).toBe(direct);
    expect(config.target).not.toContain("synthetic"); expect(config.target).not.toContain("owner");
    expect(cloudMigrationEnvironment({ DATABASE_URL: "local", DIRECT_URL: "other", DATABASE_URL_UNPOOLED: "other", OTHER: "keep" }, config)).toEqual({ DATABASE_URL: direct, DIRECT_URL: direct, DATABASE_URL_UNPOOLED: direct, OTHER: "keep" });
  });
  it.each([
    [undefined, direct], [runtime, undefined], ["bad secret URL", direct],
    [runtime.replace("sslmode=require", "sslmode=disable"), direct],
    [runtime, direct.replace("/pilot?", "/other?")],
    [runtime, direct.replace("abcdefghijklmnopqrst", "otherprojectabcdefgh")],
    [runtime, runtime], [direct, direct],
    [runtime.replace("aws-0-ap-south-1.pooler.supabase.com", "localhost"), direct],
    [runtime.replace("supabase.com", "supabase.com.example.test"), direct],
  ])("rejects missing credentials, insecure connections or mismatched/local targets", (pooled, unpooled) => {
    expect(() => cloudDatabaseConfig({ CLOUD_PROJECT_REF: "abcdefghijklmnopqrst", CLOUD_DATABASE_URL: pooled, CLOUD_DIRECT_URL: unpooled })).toThrow();
  });
});

