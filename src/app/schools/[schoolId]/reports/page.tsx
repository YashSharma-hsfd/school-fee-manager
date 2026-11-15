import Link from "next/link";
import { z } from "zod";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { schoolReport } from "@/services/fee-reports";
import { displayMoney } from "@/services/fee-calculations";

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { schoolId } = await params;
  await schoolAccess(schoolId);
  const { page, auditPage, status } = z.object({ page: z.coerce.number().int().min(1).max(100000).catch(1), auditPage: z.coerce.number().int().min(1).max(100000).catch(1), status: z.enum(["all", "overdue", "paid", "current"]).catch("all") }).parse(await searchParams);
  const [report, events] = await Promise.all([schoolReport(schoolId, page, status), prisma.auditEvent.findMany({ where: { schoolId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (auditPage - 1) * 30, take: 31 })]);
  const s = report.summary;
  const url = (nextPage: number, nextAudit = auditPage) => `?${new URLSearchParams({ page: String(nextPage), auditPage: String(nextAudit), status })}`;
  return <main className="mx-auto max-w-6xl px-6 py-10"><h1 className="text-3xl font-semibold">Reports & audit history</h1><p className="mt-2 text-sm text-slate-500">Current balances across all academic years as of {report.today} (Asia/Kolkata). An installment becomes overdue after its due date. Collections exclude reversed payments.</p>
    <div className="my-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Students", String(s.students)], ["Fees assigned", String(s.assigned)], ["Up to date", String(s.upToDate)], ["Fully paid", String(s.fullyPaid)],
      ["Students with overdue fees", String(s.overdueStudents)], ["Outstanding", displayMoney(Number(s.outstanding))], ["Overdue amount", displayMoney(Number(s.overdue))],
      ["Total received (all time)", displayMoney(report.collections._sum.amountCents || 0)], ["Discounts (all time)", displayMoney(report.discounts._sum.amountCents || 0)],
    ].map(([label, value]) => <article key={label} className="rounded-xl border bg-white p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</div>
    <form className="mb-5 flex items-center gap-3"><label htmlFor="status">Student status</label><select id="status" name="status" defaultValue={status} className="rounded-md border px-3 py-2"><option value="all">All students</option><option value="overdue">Overdue</option><option value="current">Up to date</option><option value="paid">Fully paid</option></select><button className="rounded-md bg-slate-900 px-4 py-2 text-white">Filter</button></form>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Student", "Class", "Outstanding", "Overdue", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{report.students.map(student => <tr key={student.id} className="border-t"><td className="p-3"><Link href={`/schools/${schoolId}/students/${student.id}`} className="text-indigo-700">{student.name}</Link><p className="text-xs text-slate-500">{student.admissionNumber}</p></td><td className="p-3">{student.className}</td><td className="p-3">{displayMoney(Number(student.remaining))}</td><td className="p-3">{displayMoney(Number(student.overdue))}</td><td className="p-3">{student.chargeCount === BigInt(0) ? "Fees not assigned" : student.overdue > 0 ? "Overdue" : student.remaining === BigInt(0) ? "Fully paid" : "Up to date"}</td></tr>)}</tbody></table></div>
    <nav aria-label="Report pages" className="my-5 flex gap-5 text-sm">{page > 1 && <Link href={url(page - 1)}>Previous students</Link>}{report.hasNext && <Link href={url(page + 1)}>Next students</Link>}</nav>
    <section className="mt-10"><h2 className="mb-4 text-xl font-semibold">Audit trail</h2><div className="space-y-3">{events.slice(0, 30).map(event => <details key={event.id} className="rounded-lg border bg-white p-4 text-sm"><summary className="cursor-pointer">{event.createdAt.toISOString()} · {event.actorName} · {event.action.replaceAll("_", " ")}</summary><p className="mt-3 text-xs text-slate-500">Record: {event.entityId}</p><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(event.details, null, 2)}</pre></details>)}</div><nav aria-label="Audit pages" className="mt-5 flex gap-5 text-sm">{auditPage > 1 && <Link href={url(page, auditPage - 1)}>Newer events</Link>}{events.length > 30 && <Link href={url(page, auditPage + 1)}>Older events</Link>}</nav></section>
  </main>;
}
