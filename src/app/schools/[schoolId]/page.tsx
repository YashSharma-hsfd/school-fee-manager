import { schoolAccess } from "@/lib/school";
import { SchoolOverview } from "@/components/school-overview";
import { StudentDirectory } from "@/components/student-directory";

export default async function SchoolPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { schoolId } = await params;
  const { school, membership, user } = await schoolAccess(schoolId);
  return <main id="main-content" className="mx-auto max-w-7xl px-6 py-8"><p className="text-sm font-medium text-indigo-700">School overview</p><h1 className="mt-2 text-3xl font-semibold">{school.name}</h1><SchoolOverview schoolId={schoolId} membership={membership} /><StudentDirectory schoolId={schoolId} membership={membership} globalRole={user.role} searchParams={await searchParams} basePath={`/schools/${schoolId}`} /></main>;
}
