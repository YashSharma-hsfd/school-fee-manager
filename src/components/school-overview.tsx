import Link from "next/link";
import type { SchoolAccess } from "@/services/school-permissions";
import { schoolDashboard } from "@/services/dashboard";
import { dateOnly, displayMoney } from "@/services/fee-calculations";
import { selectSchool } from "@/actions/schools";

export async function SchoolOverview({ schoolId, membership }: { schoolId: string; membership: SchoolAccess }) {
  const data = await schoolDashboard(schoolId);
  const s = data.summary, base = `/schools/${schoolId}`;
  const cards = [
    ["Collected today", displayMoney(Number(data.daily.total)), `${base}/reports?from=${data.today}&to=${data.today}`],
    ["Collected this month", displayMoney(Number(data.monthly.total)), `${base}/reports?from=${data.monthStart}&to=${data.today}`],
    ["Outstanding fees", displayMoney(Number(s.outstanding)), `${base}/reports`],
    ["Overdue fees", displayMoney(Number(s.overdue)), `${base}/reports?status=overdue`],
    ["Students with overdue fees", String(s.overdueStudents), `${base}/reports?status=overdue`],
    ["Active students", String(s.active), `${base}?status=ACTIVE#student-search`],
    ["Inactive students", String(s.inactive), `${base}?status=INACTIVE#student-search`],
    ["Withdrawn students", String(s.withdrawn), `${base}?status=WITHDRAWN#student-search`],
  ];
  return <section aria-label="School overview" className="my-8 space-y-5">
    <p className="text-sm text-slate-500">As of {data.today} (Asia/Kolkata). Collections use payment dates and exclude reversals. Balances include all years and student statuses.</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-xl border bg-white p-5 no-underline shadow-sm transition hover:border-indigo-500 hover:shadow-md"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-2 text-2xl font-semibold">{value}</p><span className="mt-3 block text-sm font-medium text-indigo-700 underline">View details →</span></Link>)}</div>
    {s.unassigned > BigInt(0) && <p className="rounded-lg bg-amber-50 p-4 text-sm">{String(s.unassigned)} active students have no fees assigned. Administration should review their accounts and enroll them in a configured academic year.</p>}
    <nav aria-label="Quick actions" className="flex flex-wrap gap-4 text-sm font-medium text-indigo-700">
      {membership.role === "ADMIN" && <><form action={selectSchool.bind(null, schoolId, "students")}><button>Manage students</button></form><Link href={`${base}/operations`}>Import / promote</Link></>}
      {membership.role === "ACCOUNTANT" && <Link href={`${base}#student-search`}>Find student / collect payment</Link>}
      <Link href={`${base}/reports?status=overdue`}>Review overdue accounts</Link><Link href={`${base}/reports`}>Reports & exports</Link>
      {(membership.configureFees || membership.manageAccess) && <Link href={`${base}/settings`}>School configuration</Link>}
    </nav>
    <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Recently recorded payments</h2>{!data.recent.length ? <p className="text-sm text-slate-500">No active payments recorded yet.</p> : <ul className="divide-y">{data.recent.map(payment => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><Link className="font-medium text-indigo-700" href={`${base}/students/${payment.studentId}`}>{payment.studentName}</Link><p className="mt-1 text-slate-500">Paid {dateOnly(payment.paidOn)} · {payment.mode.replaceAll("_", " ")}</p></div><span className="font-semibold">{displayMoney(payment.amountCents)}</span><Link className="text-indigo-700" href={`${base}/receipts/${payment.id}`}>{payment.receiptNumber}</Link></li>)}</ul>}</section>
  </section>;
}
