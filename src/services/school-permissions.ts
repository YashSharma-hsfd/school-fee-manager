import type { StaffRole } from "./auth";
export class SchoolAccessError extends Error {
  constructor() { super("You do not have permission for this school or action."); }
}
export type SchoolAccess = { role: StaffRole; canConfigureFees: boolean; canManageAccess: boolean; isActive?: boolean };
export type SchoolPermission = "view" | "students" | "enroll" | "assignFees" | "payments" | "configure" | "access";
export function hasSchoolPermission(member: SchoolAccess | null, permission: SchoolPermission): boolean {
  if (!member || member.isActive === false) return false;
  return permission === "view" ||
    (permission === "students" && member.role === "ADMIN") ||
    ((permission === "enroll" || permission === "assignFees") && (member.role === "ADMIN" || member.role === "MANAGEMENT")) ||
    (permission === "payments" && member.role === "ACCOUNTANT") ||
    (permission === "configure" && member.role !== "MANAGEMENT" && member.canConfigureFees) ||
    (permission === "access" && member.role !== "MANAGEMENT" && member.canManageAccess);
}
export function assertSchoolPermission(member: SchoolAccess | null, permission: SchoolPermission) {
  if (!hasSchoolPermission(member, permission)) throw new SchoolAccessError();
}
