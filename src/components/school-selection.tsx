import Link from "next/link";
import { roleNames } from "@/services/workspace";
import type { SchoolAccess } from "@/services/school-permissions";

export function SchoolSelection({ memberships }: { memberships: (SchoolAccess & { schoolId: string; school: { name: string; code: string } })[] }) {
  return <div className="grid gap-5 sm:grid-cols-2">{memberships.map(member => <Link key={member.schoolId} href={`/schools/${member.schoolId}`} className="group rounded-2xl border border-slate-200 bg-white p-6 no-underline shadow-sm transition hover:border-indigo-500 hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-slate-900">{member.school.name}</h2><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">{roleNames[member.role]}</span></div><p className="mt-3 text-sm text-slate-500">School code: {member.school.code}</p>{(member.configureFees || member.manageAccess) && <p className="mt-2 text-xs text-slate-500">Additional access: {[member.configureFees && "fee configuration", member.manageAccess && "staff access"].filter(Boolean).join(", ")}</p>}<span className="mt-6 inline-flex rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white group-hover:bg-indigo-800">Open workspace</span></Link>)}</div>;
}
