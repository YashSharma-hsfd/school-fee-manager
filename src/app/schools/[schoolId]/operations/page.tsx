import { StudentBatchOperations } from "@/components/student-batch-operations";
import { hasSchoolPermission } from "@/services/school-permissions";
import Link from "next/link";
import { schoolAccess } from "@/lib/school";
import { StudentImport } from "@/components/student-import";
import { prisma } from "@/lib/prisma";
import { PromotionForm } from "@/components/promotion-form";
import { Button } from "@/components/ui/button";

import { displayMoney } from "@/services/fee-calculations";
import { z } from "zod";

export default async function OperationsPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { schoolId } = await params;
  const { membership } = await schoolAccess(schoolId, "enroll");
  const search = await searchParams;
  const query = z.object({ sourceYearId: z.string().max(128).catch(""), sourceClassId: z.string().max(128).catch(""), academicYearId: z.string().max(128).catch(""), classId: z.string().max(128).catch("") }).parse(search);
  const [years, classes, plan, sections] = await Promise.all([
    prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } }),
    prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    query.academicYearId && query.classId ? prisma.feePlan.findFirst({ where: { schoolId, academicYearId: query.academicYearId, classId: query.classId }, include: { items: true } }) : null,
    prisma.classSection.findMany({ where: { schoolId, academicYearId: query.academicYearId || "__none__", classId: query.classId || "__none__", isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const students = query.sourceYearId && query.sourceClassId ? await prisma.student.findMany({ where: { schoolId, status: "ACTIVE", enrollments: { some: { academicYearId: query.sourceYearId, classId: query.sourceClassId }, none: { academicYearId: query.academicYearId } } }, orderBy: [{ admissionNumber: "asc" }, { id: "asc" }], take: 100 }) : [];
  return <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-6 py-10"><h1 className="text-3xl font-semibold">Student operations</h1><p className="text-sm text-slate-500">Enroll students, assign configured class fees or promote selected students. Review the selection before confirming.</p><nav aria-label="Student operations" className="flex flex-wrap gap-3 text-sm font-semibold text-indigo-700">{hasSchoolPermission(membership, "students") && <a href="#student-import">Import students</a>}<a href="#bulk-enrollment">Bulk enrollment / fees</a><a href="#bulk-promotion">Bulk promotion</a><Link href={`/schools/${schoolId}/students`}>Find student accounts</Link></nav>{hasSchoolPermission(membership, "students") && <div id="student-import"><StudentImport schoolId={schoolId} /></div>}
    <StudentBatchOperations schoolId={schoolId} searchParams={search} years={years} classes={classes} />
    <section id="bulk-promotion" className="space-y-5 rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Bulk promotion</h2><p className="text-sm text-slate-600">Preview a source class and destination. Select up to 100 students per batch. Earlier dues remain. Only active students are eligible. Students already enrolled in the destination year are excluded.</p><form className="grid gap-4 sm:grid-cols-2">{[
      ["sourceYearId", "Source academic year", years.map(y => ({ id: y.id, name: y.name }))],
      ["sourceClassId", "Source class", classes], ["academicYearId", "Destination academic year", years], ["classId", "Destination class", classes],
    ].map(([name, label, options]) => <label key={name as string}>{label as string}<select required name={name as string} defaultValue={query[name as keyof typeof query]} className="mt-1 block w-full rounded border p-2"><option value="">Choose</option>{(options as { id: string; name: string }[]).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}<Button>Preview promotion</Button></form>
    {query.academicYearId && <p>Destination fees per student: {plan ? displayMoney(plan.items.reduce((sum, item) => sum + item.amountPaise, 0)) : "Fees not configured. Enrollment can proceed; configure the destination fee plan before collection."}</p>}
    {query.academicYearId && query.classId && query.sourceYearId && query.sourceClassId && <PromotionForm schoolId={schoolId} query={query} students={students} sections={sections} annualPaise={plan ? plan.items.reduce((sum, item) => sum + item.amountPaise, 0) : null} />}
    </section>
  </main>;
}
