import { describe, expect, it } from "vitest";
import { assertSchoolPermission, SchoolAccessError } from "../../src/services/school-permissions";
describe("school permissions", () => {
  it.each(["view", "students", "payments", "configure", "access"] as const)("denies %s without school membership", permission => expect(() => assertSchoolPermission(null, permission)).toThrow(SchoolAccessError));
  it.each(["ADMIN", "ACCOUNTANT", "MANAGEMENT"] as const)("allows %s to view only their schools", role => expect(() => assertSchoolPermission({ role, configureFees: false, manageAccess: false }, "view")).not.toThrow());
  it.each(["students", "payments", "configure", "access"] as const)("keeps management read-only for %s", permission => expect(() => assertSchoolPermission({ role: "MANAGEMENT", configureFees: false, manageAccess: false }, permission)).toThrow());
  it("separates accountant payment access from student administration", () => {
    expect(() => assertSchoolPermission({ role: "ACCOUNTANT", configureFees: false, manageAccess: false }, "payments")).not.toThrow();
    expect(() => assertSchoolPermission({ role: "ACCOUNTANT", configureFees: false, manageAccess: false }, "students")).toThrow();
    expect(() => assertSchoolPermission({ role: "ADMIN", configureFees: false, manageAccess: false }, "payments")).toThrow();
  });
  it("requires explicit grants for configuration and staff access", () => {
    expect(() => assertSchoolPermission({ role: "ADMIN", configureFees: false, manageAccess: false }, "configure")).toThrow();
    expect(() => assertSchoolPermission({ role: "MANAGEMENT", configureFees: true, manageAccess: false }, "configure")).not.toThrow();
    expect(() => assertSchoolPermission({ role: "ADMIN", configureFees: true, manageAccess: false }, "access")).toThrow();
  });
});
