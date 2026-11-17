import Link from "next/link";
import type { SchoolAccess } from "@/services/school-permissions";
import { roleWorkflow } from "@/services/workspace";
import { selectSchool } from "@/actions/schools";
import { Button } from "./ui/button";

export function RoleWorkflow({ schoolId, membership }: { schoolId: string; membership: SchoolAccess }) {
  const flow = roleWorkflow(membership), base = `/schools/${schoolId}`;
  return <section aria-label="Your workflow" className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-5"><div><h2 className="text-xl font-semibold">{flow.title}</h2><p className="mt-2 text-sm text-slate-500">{flow.description}</p></div><div className="flex flex-wrap gap-3">
    {membership.role === "ADMIN" ? <form action={selectSchool.bind(null,schoolId,"students")}><Button>Manage students</Button></form> : <Button asChild><Link href={membership.role === "ACCOUNTANT" ? `${base}/students` : `${base}/reports`}>{membership.role === "ACCOUNTANT" ? "Find student / collect payment" : "Open reports & exports"}</Link></Button>}
    <Button asChild variant="outline"><Link href={`${base}/reports?status=overdue`}>Review overdue accounts</Link></Button>
  </div></div><details className="mt-5 border-t border-slate-100 pt-4"><summary className="text-sm">How this workspace works</summary><ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{flow.steps.map((step,i) => <li key={step} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">{i+1}</span><span>{step}</span></li>)}</ol></details>
  {membership.role === "MANAGEMENT" && <p className="mt-4 text-xs text-slate-500">You can enroll students and assign existing class fees. Student profiles, fee structures, payments and staff access remain restricted.</p>}
  </section>;
}
