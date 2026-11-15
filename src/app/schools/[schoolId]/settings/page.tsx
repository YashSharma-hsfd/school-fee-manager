import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { FeePlanForm, SchoolForm } from "@/components/school-forms";
import { grantAccess, setupSchool } from "@/actions/schools";
import { displayMoney, dateOnly } from "@/services/fee-calculations";

export default async function SettingsPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const { membership } = await schoolAccess(schoolId);
  if (!membership.configureFees && !membership.manageAccess) return <main className="mx-auto max-w-6xl p-8"><p>You do not have configuration permissions.</p></main>;
  const [years, classes, plans, members] = await Promise.all([
    prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } }),
    prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.feePlan.findMany({ where: { schoolId }, include: { academicYear: true, schoolClass: true, items: { orderBy: [{ dueOn: "asc" }, { label: "asc" }] } }, orderBy: { createdAt: "desc" } }),
    membership.manageAccess ? prisma.schoolMembership.findMany({ where: { schoolId }, include: { user: { select: { name: true, email: true } } } }) : [],
  ]);
  return <main className="mx-auto max-w-6xl px-6 py-10"><h1 className="mb-8 text-3xl font-semibold">School configuration</h1>
    {membership.configureFees && <>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Academic year</h2><SchoolForm action={setupSchool.bind(null, schoolId, "year")} submit="Add academic year" fields={[{ name: "name", label: "Year name", help: "For example: 2026–27" }, { name: "startsOn", label: "Starts on", type: "date" }, { name: "endsOn", label: "Ends on", type: "date", help: "Usually April through March. Promotion is always manual." }]} /><ul className="mt-5 space-y-2 text-sm text-slate-500">{years.map(year => <li key={year.id}>{year.name}: {dateOnly(year.startsOn)} to {dateOnly(year.endsOn)}</li>)}</ul></section>
        <section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Classes</h2><SchoolForm action={setupSchool.bind(null, schoolId, "class")} submit="Add class" fields={[{ name: "name", label: "Class name" }]} /><p className="mt-5 text-sm text-slate-500">{classes.map(item => item.name).join(", ") || "No classes configured yet."}</p></section>
      </div>
      <section className="mt-6 max-w-2xl rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Class fee plan</h2>{years.length && classes.length ? <FeePlanForm action={setupSchool.bind(null, schoolId, "plan")} years={years.map(year => ({ value: year.id, label: year.name }))} classes={classes.map(item => ({ value: item.id, label: item.name }))} /> : <p>Add an academic year and class first.</p>}</section>
      <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">Configured fee plans</h2><div className="grid items-start gap-5 md:grid-cols-2">{plans.map(plan => <details key={plan.id} className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">{plan.schoolClass.name} · {plan.academicYear.name} · {displayMoney(plan.items.reduce((sum, item) => sum + item.amountCents, 0))} annually</summary><ul className="mt-4 space-y-2 text-sm">{plan.items.map(item => <li key={item.id} className="flex justify-between gap-4"><span>{item.label} · due {dateOnly(item.dueOn)}</span><span>{displayMoney(item.amountCents)}</span></li>)}</ul></details>)}</div></section>
    </>}
    {membership.manageAccess && <section className="mt-8 max-w-2xl rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">School staff access</h2><p className="mb-4 text-sm text-slate-500">Use an existing staff account. Roles apply only to this school. Fee configuration and staff-access permissions are separate grants.</p><SchoolForm action={grantAccess.bind(null, schoolId)} submit="Save school access" fields={[{ name: "email", label: "Staff email", type: "email" }, { name: "role", label: "Role", options: [{ value: "ADMIN", label: "Administration — students and enrollment" }, { value: "ACCOUNTANT", label: "Accountant — payments, receipts and discounts" }, { value: "MANAGEMENT", label: "Management — read-only reports" }] }, { name: "configureFees", label: "May configure fees, classes and years", type: "checkbox" }, { name: "manageAccess", label: "May manage school staff access", type: "checkbox" }]} /><ul className="mt-5 space-y-2 text-sm text-slate-500">{members.map(member => <li key={member.userId}>{member.user.name} ({member.user.email}): {member.role}{member.configureFees ? ", fee configuration" : ""}{member.manageAccess ? ", access management" : ""}</li>)}</ul></section>}
  </main>;
}
