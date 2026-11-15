import Link from "next/link";
import { SchoolSelection } from "@/components/school-selection";
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
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Your schools</h1><p className="mt-2 text-slate-500">Welcome, {user.name}. Each school has its own students, fees and receipts.</p></div><div className="flex flex-wrap items-center gap-4"><Link href="/account" className="text-sm text-indigo-700">Your password</Link><form action={logout}><Button variant="outline">Sign out</Button></form></div></header>
    <p className="mb-5 text-sm text-slate-500">Choose a school to open your workspace. The role on each card applies only to that school.</p><SchoolSelection memberships={memberships} />
    {!memberships.length && <p className="my-6 rounded-lg bg-slate-50 p-5">{user.role === "ADMIN" ? "Create your first school below, or ask an access manager to add you to an existing school." : "Ask your school's access manager to grant you access."}</p>}
    {user.role === "ADMIN" && <section className="mt-8 max-w-lg rounded-xl border bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Create school</h2><SchoolForm action={addSchool} submit="Create school" fields={[{ name: "name", label: "School name" }, { name: "code", label: "School code", help: "2–12 letters or digits. Used as the receipt prefix; choose a permanent code." }]} /></section>}
  </main>;
}
