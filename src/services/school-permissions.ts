import type { StaffRole } from "./auth";
export class SchoolAccessError extends Error {
  constructor() { super("You do not have permission for this school or action."); }
}
export type SchoolAccess = { role: StaffRole; configureFees: boolean; manageAccess: boolean };
export type SchoolPermission = "view" | "students" | "payments" | "configure" | "access";
export function assertSchoolPermission(member: SchoolAccess | null, permission: SchoolPermission) {
  if (!member) throw new SchoolAccessError();
  const allowed = permission === "view" ||
    (permission === "students" && member.role === "ADMIN") ||
    (permission === "payments" && member.role === "ACCOUNTANT") ||
    (permission === "configure" && member.configureFees) ||
    (permission === "access" && member.manageAccess);
  if (!allowed) throw new SchoolAccessError();
}
