import Link from "next/link";
import { Button } from "@/components/ui/button";
import { activeSchool } from "@/lib/school";
import { schoolReport } from "@/services/fee-reports";
import { displayMoney } from "@/services/fee-calculations";

export default async function Dashboard() {
  const { school } = await activeSchool();
  const report = await schoolReport(school.id, 1, "all");
  return <main className="mx-auto max-w-6xl px-6 py-12"><header className="mb-10 border-b pb-6"><p className="text-sm font-semibold text-indigo-600">{school.name}</p><h1 className="mt-3 text-3xl font-semibold">Dashboard</h1><p className="mt-2 text-slate-500">Student administration and school finance.</p></header><section className="grid gap-5 sm:grid-cols-3">{[
    ["Students", String(report.summary.students)], ["Fees received", displayMoney(report.collections._sum.amountCents || 0)], ["Outstanding fees", displayMoney(Number(report.summary.outstanding))],
  ].map(([label, value]) => <article key={label} className="rounded-xl border bg-white p-6"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-3xl font-semibold">{value}</p></article>)}</section><section className="mt-8 flex flex-wrap gap-4 rounded-xl border bg-white p-6"><Button asChild><Link href="/admin/students">Manage students</Link></Button><Button asChild variant="outline"><Link href={`/schools/${school.id}`}>Student fee accounts</Link></Button><Button asChild variant="outline"><Link href={`/schools/${school.id}/reports`}>Reports & audit</Link></Button></section></main>;
}
