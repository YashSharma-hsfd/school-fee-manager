import { schoolAccess } from "@/lib/school";
import { StudentDirectory } from "@/components/student-directory";

export default async function StudentAccountsPage({params,searchParams}: {params:Promise<{schoolId:string}>; searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {schoolId}=await params;
  const {membership,user}=await schoolAccess(schoolId);
  return <main id="main-content" className="mx-auto max-w-7xl space-y-6 px-6 py-8"><header><p className="text-sm font-medium text-indigo-700">Student accounts</p><h1 className="mt-2 text-3xl font-semibold">{membership.role === "ACCOUNTANT" ? "Find an account to collect fees" : "Find a student account"}</h1><p className="mt-3 max-w-2xl text-sm text-slate-500">Search by student name, admission number, guardian name or phone, then narrow by class and status. Open an account to review charges, payments and receipts.</p></header><StudentDirectory schoolId={schoolId} membership={membership} globalRole={user.role} searchParams={await searchParams} basePath={`/schools/${schoolId}/students`} /></main>;
}
