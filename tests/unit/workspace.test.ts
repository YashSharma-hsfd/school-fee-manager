import { describe, expect, it } from "vitest";
import { roleWorkflow, workspaceLinks } from "../../src/services/workspace";

describe("role workspace navigation", () => {
  it.each(["ADMIN","ACCOUNTANT","MANAGEMENT"] as const)("provides common read navigation for %s in the selected school", role => {
    const links=workspaceLinks("school-a",{role,canConfigureFees:false,canManageAccess:false});
    expect(links.map(link=>link.label)).toEqual(expect.arrayContaining(["Overview","Student accounts","Reports & audit"]));
    expect(links.every(link=>link.href.startsWith("/schools/school-a"))).toBe(true);
  });
  it("separates import from management enrollment and restricts configuration grants", () => {
    const admin=workspaceLinks("a",{role:"ADMIN",canConfigureFees:false,canManageAccess:false});
    expect(admin.map(link=>link.label)).toContain("Import & promotion");
    expect(admin.map(link=>link.label)).not.toContain("Configuration");
    for(const role of ["ACCOUNTANT","MANAGEMENT"] as const){
      const plain=workspaceLinks("a",{role,canConfigureFees:false,canManageAccess:false});
      expect(plain.map(link=>link.label)).not.toContain("Import & promotion");
      expect(plain.map(link=>link.label)).not.toContain("Configuration");
      expect(workspaceLinks("a",{role,canConfigureFees:true,canManageAccess:false}).map(link=>link.label).includes("Configuration")).toBe(role !== "MANAGEMENT");
      expect(workspaceLinks("a",{role,canConfigureFees:false,canManageAccess:true}).map(link=>link.label).includes("Configuration")).toBe(role !== "MANAGEMENT");
      expect(plain.some(link => link.href.endsWith("/operations"))).toBe(role === "MANAGEMENT");
    }
  });
  it("gives role-specific guidance without telling an ungranted administrator to configure fees", () => {
    expect(roleWorkflow({role:"ADMIN",canConfigureFees:false,canManageAccess:false}).steps[0]).toContain("configurator");
    expect(roleWorkflow({role:"ACCOUNTANT",canConfigureFees:false,canManageAccess:false}).steps).toContain("Record payment and issue receipt");
    expect(roleWorkflow({role:"MANAGEMENT",canConfigureFees:false,canManageAccess:false}).steps).not.toContain("Record payment and issue receipt");
  });
});
