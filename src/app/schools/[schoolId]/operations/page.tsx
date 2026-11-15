import Link from "next/link";
import { schoolAccess } from "@/lib/school";
import { StudentImport } from "@/components/student-import";
import { prisma } from "@/lib/prisma";
import { SchoolForm } from "@/components/school-forms";
import { promoteStudents } from "@/actions/operations";
import { displayMoney } from "@/services/fee-calculations";
import { z } from "zod";

export default async function OperationsPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { schoolId } = await params;
  await schoolAccess(schoolId, "students");
  const query = z.object({ sourceYearId: z.string().max(128).catch(""), sourceClassId: z.string().max(128).catch(""), academicYearId: z.string().max(128).catch(""), classId: z.string().max(128).catch("") }).parse(await searchParams);
  const [years, classes, plan] = await Promise.all([
    prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } }),
    prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    query.academicYearId && query.classId ? prisma.feePlan.findFirst({ where: { schoolId, academicYearId: query.academicYearId, classId: query.classId }, include: { items: true } }) : null,
  ]);
  const students = query.sourceYearId && query.sourceClassId ? await prisma.student.findMany({ where: { schoolId, status: "ACTIVE", enrollments: { some: { academicYearId: query.sourceYearId, classId: query.sourceClassId }, none: { academicYearId: query.academicYearId } } }, orderBy: [{ admissionNumber: "asc" }, { id: "asc" }], take: 100 }) : [];
  return <main className="mx-auto max-w-6xl space-y-8 px-6 py-10"><h1 className="text-3xl font-semibold">Student operations</h1><p className="text-sm text-slate-500">Import new student records or promote selected existing students. Review the preview before confirming either action.</p><nav aria-label="Student operations" className="flex flex-wrap gap-3 text-sm font-semibold text-indigo-700"><a href="#student-import">Import students</a><a href="#bulk-promotion">Bulk promotion</a><Link href={`/schools/${schoolId}/students`}>Find student accounts</Link></nav><div id="student-import"><StudentImport schoolId={schoolId} /></div>
    <section id="bulk-promotion" className="space-y-5 rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Bulk promotion</h2><p className="text-sm text-slate-600">Preview a source class and destination. Select up to 100 students per batch. Earlier dues remain. Only active students are eligible. Students already enrolled in the destination year are excluded.</p><form className="grid gap-4 sm:grid-cols-2">{[
      ["sourceYearId", "Source academic year", years.map(y => ({ id: y.id, name: y.name }))],
      ["sourceClassId", "Source class", classes], ["academicYearId", "Destination academic year", years], ["classId", "Destination class", classes],
    ].map(([name, label, options]) => <label key={name as string}>{label as string}<select required name={name as string} defaultValue={query[name as keyof typeof query]} className="mt-1 block w-full rounded border p-2"><option value="">Choose</option>{(options as { id: string; name: string }[]).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}<button className="rounded bg-slate-900 px-4 py-2 text-white">Preview promotion</button></form>
    {query.academicYearId && <p>Destination fees per student: {plan ? displayMoney(plan.items.reduce((sum, item) => sum + item.amountCents, 0)) : "No fee plan configured. Create it before promoting."}</p>}
    {plan && students.length > 0 ? <SchoolForm action={promoteStudents.bind(null, schoolId)} submit="Confirm promotion of selected students" fields={Object.entries(query).map(([name, value]) => ({ name, label: "", type: "hidden", value }))}><fieldset className="max-h-80 space-y-2 overflow-auto"><legend className="mb-3 font-medium">Select students ({students.length} shown)</legend>{students.map(student => <label key={student.id} className="block text-sm"><input type="checkbox" name="studentIds" value={student.id} className="mr-3" />{student.admissionNumber} — {student.name}</label>)}</fieldset></SchoolForm> : query.sourceYearId && <p>No eligible students to display, or the destination plan is missing.</p>}
    </section>
  </main>;
}
