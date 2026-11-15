import Link from "next/link";
import { activeSchool } from "@/lib/school";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, school } = await activeSchool();
  return <><nav aria-label="Staff account" className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 pt-6 text-sm"><Link href="/schools">All schools</Link><Link href={`/schools/${school.id}`} className="font-semibold">{school.name}</Link><Link href="/admin/dashboard">Dashboard</Link><Link href="/admin/students">Students</Link><Link href={`/schools/${school.id}/reports`}>Reports</Link><span className="text-slate-500">{user.name}</span><form action={logout} className="ml-auto"><Button variant="outline">Sign out</Button></form></nav>{children}</>;
}
