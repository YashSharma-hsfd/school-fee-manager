import { describe, expect, it } from "vitest";
import { cloudDatabaseConfig, cloudMigrationEnvironment } from "../../scripts/cloud-db-config.mjs";

const runtime = "postgresql://app:synthetic%21@ep-example-pooler.ap-southeast-1.aws.neon.tech/pilot?sslmode=require";
const direct = "postgresql://owner:synthetic%21@ep-example.ap-southeast-1.aws.neon.tech/pilot?sslmode=require";
describe("isolated cloud pilot commands", () => {
  it("keeps the runtime pooled and migrations direct, allowing separate credentials", () => {
    const config = cloudDatabaseConfig({ CLOUD_DATABASE_URL: runtime, CLOUD_DIRECT_URL: direct });
    expect(config.runtimeUrl).toBe(runtime); expect(config.directUrl).toBe(direct);
    expect(config.target).not.toContain("synthetic"); expect(config.target).not.toContain("owner");
    expect(cloudMigrationEnvironment({ DATABASE_URL: "local", DIRECT_URL: "other", DATABASE_URL_UNPOOLED: "other", OTHER: "keep" }, config)).toEqual({ DATABASE_URL: direct, DIRECT_URL: direct, DATABASE_URL_UNPOOLED: direct, OTHER: "keep" });
  });
  it.each([
    [undefined, direct], [runtime, undefined], ["bad secret URL", direct],
    [runtime.replace("sslmode=require", "sslmode=disable"), direct],
    [runtime, direct.replace("/pilot?", "/other?")],
    [runtime, direct.replace("ep-example.", "ep-other.")],
    [runtime, runtime], [direct, direct],
    [runtime.replace("ep-example-pooler.ap-southeast-1.aws.neon.tech", "localhost"), direct],
    [runtime.replace("neon.tech", "neon.tech.example.test"), direct],
  ])("rejects missing credentials, insecure connections or mismatched/local targets", (pooled, unpooled) => {
    expect(() => cloudDatabaseConfig({ CLOUD_DATABASE_URL: pooled, CLOUD_DIRECT_URL: unpooled })).toThrow();
  });
});
