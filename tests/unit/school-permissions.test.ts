import { describe, expect, it } from "vitest";
import { assertSchoolPermission, SchoolAccessError } from "../../src/services/school-permissions";
describe("school permissions", () => {
  it.each(["view", "students", "enroll", "assignFees", "payments", "configure", "access"] as const)("denies %s without school membership", permission => expect(() => assertSchoolPermission(null, permission)).toThrow(SchoolAccessError));
  it.each(["ADMIN", "ACCOUNTANT", "MANAGEMENT"] as const)("allows %s to view only their schools", role => expect(() => assertSchoolPermission({ role, canConfigureFees: false, canManageAccess: false }, "view")).not.toThrow());
  it.each(["students", "payments", "configure", "access"] as const)("denies management access to %s", permission => expect(() => assertSchoolPermission({ role: "MANAGEMENT", canConfigureFees: false, canManageAccess: false }, permission)).toThrow());
  it("separates accountant payment access from student administration", () => {
    expect(() => assertSchoolPermission({ role: "ACCOUNTANT", canConfigureFees: false, canManageAccess: false }, "payments")).not.toThrow();
    expect(() => assertSchoolPermission({ role: "ACCOUNTANT", canConfigureFees: false, canManageAccess: false }, "students")).toThrow();
    expect(() => assertSchoolPermission({ role: "ADMIN", canConfigureFees: false, canManageAccess: false }, "payments")).toThrow();
  });
  it("requires explicit grants for configuration and staff access", () => {
    expect(() => assertSchoolPermission({ role: "ADMIN", canConfigureFees: false, canManageAccess: false }, "configure")).toThrow();
    expect(() => assertSchoolPermission({ role: "MANAGEMENT", canConfigureFees: true, canManageAccess: false }, "configure")).toThrow();
    expect(() => assertSchoolPermission({ role: "ADMIN", canConfigureFees: true, canManageAccess: false }, "access")).toThrow();
  });
});
