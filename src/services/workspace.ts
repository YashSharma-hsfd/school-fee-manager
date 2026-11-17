import { hasSchoolPermission, type SchoolAccess } from "./school-permissions";

export const roleNames = { ADMIN: "Administration", ACCOUNTANT: "Accountant", MANAGEMENT: "Management" } as const;
export function workspaceLinks(schoolId: string, member: SchoolAccess) {
  const base = `/schools/${encodeURIComponent(schoolId)}`;
  return [
    { label: "Overview", href: base, exact: true },
    { label: "Student accounts", href: `${base}/students`, exact: false },
    { label: "Reports & audit", href: `${base}/reports`, exact: false },
    ...(hasSchoolPermission(member, "enroll") ? [{ label: member.role === "ADMIN" ? "Import & promotion" : "Student operations", href: `${base}/operations`, exact: false }] : []),
    ...(hasSchoolPermission(member, "configure") || hasSchoolPermission(member, "access") ? [{ label: "Configuration", href: `${base}/settings`, exact: false }] : []),
  ];
}

export function roleWorkflow(member: SchoolAccess) {
  if (member.role === "ADMIN") return { title: "Admin workspace", description: "Keep student records and academic-year fees ready for collection.", steps: [member.canConfigureFees ? "Configure classes and fee plans" : "Confirm plans with your fee configurator", "Add or find a student", "Enroll, promote or update status", "Review charges and audit history"] };
  if (member.role === "ACCOUNTANT") return { title: "Accountant workspace", description: "Find the right account, collect fees and issue a receipt.", steps: ["Search by name, class or guardian phone", "Confirm student identity and outstanding dues", "Record payment and issue receipt", "Print or save PDF, then reconcile collections"] };
  return { title: "Management workspace", description: "Enroll students, assign configured fees and review collections.", steps: ["Enroll students in a class", "Assign the existing class fee plan", "Review outstanding fees and collections", "Download the required report"] };
}
