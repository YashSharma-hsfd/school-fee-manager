import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AccountantPage() {
  const user = await requireRole("ACCOUNTANT");
  return <main className="mx-auto max-w-6xl px-6 py-12"><header className="flex items-center justify-between border-b border-slate-200 pb-6"><div><p className="text-sm font-semibold text-indigo-600">School Fee Manager</p><h1 className="mt-3 text-3xl font-semibold">Accountant workspace</h1><p className="mt-2 text-slate-500">Welcome, {user.name}.</p></div><form action={logout}><Button variant="outline">Sign out</Button></form></header><p className="mt-8 text-slate-500">Select your school to record payments, issue receipts and view student dues.</p><Button asChild className="mt-5"><Link href="/schools">Open schools</Link></Button></main>;
}
