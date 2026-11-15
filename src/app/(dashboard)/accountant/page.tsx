import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { SchoolSelection } from "@/components/school-selection";

export default async function AccountantPage() {
  const user = await requireRole("ACCOUNTANT");
  const memberships=await prisma.schoolMembership.findMany({where:{userId:user.id},include:{school:true},orderBy:{school:{name:"asc"}}});
  return <main className="mx-auto max-w-6xl space-y-8 px-6 py-12"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">School Fee Manager</p><h1 className="mt-3 text-3xl font-semibold">Accountant workspace</h1><p className="mt-2 text-slate-500">Welcome, {user.name}. Choose a school to begin.</p></div><div className="flex items-center gap-3"><Link href="/account" className="text-sm text-indigo-700">Your password</Link><form action={logout}><Button variant="outline">Sign out</Button></form></div></header><section><h2 className="mb-3 text-xl font-semibold">Find student, collect fees, issue receipt</h2><p className="mb-5 text-sm text-slate-500">Your role is shown for each school. After opening a workspace, choose Student accounts to find a student by name, class or guardian phone.</p><SchoolSelection memberships={memberships} />{!memberships.length && <p className="rounded-xl border bg-white p-5">No school access has been assigned. Ask a school access manager to add your account.</p>}</section><Button asChild variant="outline"><Link href="/schools">Open schools</Link></Button></main>;
}
