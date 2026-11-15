import { describe, expect, it } from "vitest";
import { roleWorkflow, workspaceLinks } from "../../src/services/workspace";

describe("role workspace navigation", () => {
  it.each(["ADMIN","ACCOUNTANT","MANAGEMENT"] as const)("provides common read navigation for %s in the selected school", role => {
    const links=workspaceLinks("school-a",{role,configureFees:false,manageAccess:false});
    expect(links.map(link=>link.label)).toEqual(expect.arrayContaining(["Overview","Student accounts","Reports & audit"]));
    expect(links.every(link=>link.href.startsWith("/schools/school-a"))).toBe(true);
  });
  it("limits student operations to administration and requires explicit configuration/access grants", () => {
    const admin=workspaceLinks("a",{role:"ADMIN",configureFees:false,manageAccess:false});
    expect(admin.map(link=>link.label)).toContain("Import & promotion");
    expect(admin.map(link=>link.label)).not.toContain("Configuration");
    for(const role of ["ACCOUNTANT","MANAGEMENT"] as const){
      const plain=workspaceLinks("a",{role,configureFees:false,manageAccess:false});
      expect(plain.map(link=>link.label)).not.toContain("Import & promotion");
      expect(plain.map(link=>link.label)).not.toContain("Configuration");
      expect(workspaceLinks("a",{role,configureFees:true,manageAccess:false}).map(link=>link.label)).toContain("Configuration");
      expect(workspaceLinks("a",{role,configureFees:false,manageAccess:true}).map(link=>link.label)).toContain("Configuration");
    }
  });
  it("gives role-specific guidance without telling an ungranted administrator to configure fees", () => {
    expect(roleWorkflow({role:"ADMIN",configureFees:false,manageAccess:false}).steps[0]).toContain("configurator");
    expect(roleWorkflow({role:"ACCOUNTANT",configureFees:false,manageAccess:false}).steps).toContain("Record payment and issue receipt");
    expect(roleWorkflow({role:"MANAGEMENT",configureFees:false,manageAccess:false}).steps).not.toContain("Record payment and issue receipt");
  });
});
