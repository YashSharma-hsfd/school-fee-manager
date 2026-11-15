import Link from "next/link";
import { schoolAccess } from "@/lib/school";
import { selectSchool } from "@/actions/schools";
import { logout } from "@/actions/auth";

export default async function SchoolLayout({ children, params }: { children: React.ReactNode; params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const { school, membership } = await schoolAccess(schoolId);
  return <><nav aria-label="School navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 border-b px-6 py-5 text-sm print:hidden">
    <Link href="/schools">All schools</Link><Link href={`/schools/${schoolId}`} className="font-semibold">{school.name}</Link>
    {membership.role === "ADMIN" && <form action={selectSchool.bind(null, schoolId, "students")}><button className="font-medium text-indigo-700">Student records</button></form>}
    <Link href={`/schools/${schoolId}/reports`}>Reports & audit</Link>
    <Link href="/account">Your password</Link>
    {membership.role === "ADMIN" && <Link href={`/schools/${schoolId}/operations`}>Import & promotion</Link>}
    {(membership.configureFees || membership.manageAccess) && <Link href={`/schools/${schoolId}/settings`}>Configuration</Link>}
    <form action={logout} className="ml-auto"><button>Sign out</button></form>
  </nav>{children}</>;
}
