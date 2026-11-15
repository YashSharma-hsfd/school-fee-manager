import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SchoolForm } from "@/components/school-forms";
import { addSchool } from "@/actions/schools";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function SchoolsPage() {
  const user = await readSession();
  if (!user) redirect("/login");
  const memberships = await prisma.schoolMembership.findMany({ where: { userId: user.id }, include: { school: true }, orderBy: { school: { name: "asc" } } });
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <header className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-semibold">Your schools</h1><p className="mt-2 text-slate-500">Welcome, {user.name}. Each school has its own students, fees and receipts.</p></div><form action={logout}><Button variant="outline">Sign out</Button></form></header>
    <div className="grid gap-5 sm:grid-cols-2">{memberships.map(member => <Link key={member.schoolId} href={`/schools/${member.schoolId}`} className="rounded-xl border border-slate-200 bg-white p-6 hover:border-indigo-400"><h2 className="text-xl font-semibold">{member.school.name}</h2><p className="mt-2 text-sm text-slate-500">{member.school.code} · {member.role === "ADMIN" ? "Administration" : member.role === "ACCOUNTANT" ? "Accountant" : "Management"}</p></Link>)}</div>
    {!memberships.length && <p className="my-6 rounded-lg bg-slate-50 p-5">{user.role === "ADMIN" ? "Create your first school below, or ask an access manager to add you to an existing school." : "Ask your school's access manager to grant you access."}</p>}
    {user.role === "ADMIN" && <section className="mt-8 max-w-lg rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Create school</h2><SchoolForm action={addSchool} submit="Create school" fields={[{ name: "name", label: "School name" }, { name: "code", label: "School code", help: "2–12 letters or digits. Used as the receipt prefix; choose a permanent code." }]} /></section>}
  </main>;
}
