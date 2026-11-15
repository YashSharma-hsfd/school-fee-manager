import { activeSchool } from "@/lib/school";
import { SchoolOverview } from "@/components/school-overview";

export default async function Dashboard() {
  const { school, membership } = await activeSchool();
  return <main className="mx-auto max-w-6xl px-6 py-12"><header><p className="text-sm font-semibold text-indigo-700">{school.name}</p><h1 className="mt-2 text-3xl font-semibold">Dashboard</h1></header><SchoolOverview schoolId={school.id} membership={membership} /></main>;
}
