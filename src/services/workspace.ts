import type { SchoolAccess } from "./school-permissions";

export const roleNames = { ADMIN: "Administration", ACCOUNTANT: "Accountant", MANAGEMENT: "Management" } as const;
export function workspaceLinks(schoolId: string, member: SchoolAccess) {
  const base = `/schools/${encodeURIComponent(schoolId)}`;
  return [
    { label: "Overview", href: base, exact: true },
    { label: "Student accounts", href: `${base}/students`, exact: false },
    { label: "Reports & audit", href: `${base}/reports`, exact: false },
    ...(member.role === "ADMIN" ? [{ label: "Import & promotion", href: `${base}/operations`, exact: false }] : []),
    ...(member.configureFees || member.manageAccess ? [{ label: "Configuration", href: `${base}/settings`, exact: false }] : []),
  ];
}

export function roleWorkflow(member: SchoolAccess) {
  if (member.role === "ADMIN") return { title: "Admin workspace", description: "Keep student records and academic-year fees ready for collection.", steps: [member.configureFees ? "Configure classes and fee plans" : "Confirm plans with your fee configurator", "Add or find a student", "Enroll, promote or update status", "Review charges and audit history"] };
  if (member.role === "ACCOUNTANT") return { title: "Accountant workspace", description: "Find the right account, collect fees and issue a receipt.", steps: ["Search by name, class or guardian phone", "Confirm student identity and outstanding dues", "Record payment and issue receipt", "Print or save PDF, then reconcile collections"] };
  return { title: "Management workspace", description: "Review collections, unpaid fees and the records behind the totals.", steps: ["Review school totals", "Filter outstanding and overdue accounts", "Inspect receipts and transaction history", "Download the required report"] };
}
