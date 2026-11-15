import Link from "next/link";
import { logout } from "@/actions/auth";
import { selectSchool } from "@/actions/schools";
import { roleNames, workspaceLinks } from "@/services/workspace";
import type { SchoolAccess } from "@/services/school-permissions";
import { WorkspaceNavigation } from "./workspace-navigation";
import { Button } from "./ui/button";

export function WorkspaceHeader({ school, member, userName }: { school: { id: string; name: string }; member: SchoolAccess; userName: string }) {
  return <header className="border-b border-slate-200 bg-white shadow-sm print:hidden"><div className="mx-auto max-w-7xl space-y-4 px-6 py-4">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">School Fee Manager</p><Link className="mt-1 inline-block text-xl font-semibold text-slate-900 no-underline hover:text-indigo-700" href={`/schools/${school.id}`}>{school.name}</Link></div>
      <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">{roleNames[member.role]}</span><span className="text-sm text-slate-500">{userName}</span><Button asChild variant="outline" size="sm"><Link href="/schools">All schools</Link></Button><Link href="/account" className="text-sm text-indigo-700">Your password</Link><form action={logout}><Button variant="outline" size="sm">Sign out</Button></form></div>
    </div><WorkspaceNavigation links={workspaceLinks(school.id,member)} studentAction={member.role === "ADMIN" ? selectSchool.bind(null,school.id,"students") : undefined} />
  </div></header>;
}
