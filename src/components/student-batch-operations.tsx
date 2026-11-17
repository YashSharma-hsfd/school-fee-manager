import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BatchStudentsForm } from "./batch-students-form";
import { Button } from "./ui/button";
import { displayMoney } from "@/services/fee-calculations";

export async function StudentBatchOperations({ schoolId, searchParams, years, classes }: {
  schoolId: string; searchParams: Record<string, string | string[] | undefined>;
  years: { id: string; name: string }[]; classes: { id: string; name: string }[];
}) {
  const query = z.object({ batchYearId: z.string().max(128).catch(""), batchClassId: z.string().max(128).catch(""), batchSearch: z.string().trim().max(120).catch(""), batchPage: z.coerce.number().int().min(1).max(10000).catch(1) }).parse(searchParams);
  const { batchYearId: academicYearId, batchClassId: classId, batchSearch: search, batchPage: page } = query;
  const ready = years.some(year => year.id === academicYearId) && classes.some(item => item.id === classId);
  const studentFilter = { schoolId, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { admissionNumber: { contains: search, mode: "insensitive" as const } }] } : {}) };
  const [students, enrollments, sections, plan] = ready ? await Promise.all([
    prisma.student.findMany({ where: { ...studentFilter, status: "ACTIVE", enrollments: { none: { academicYearId } } }, orderBy: [{ admissionNumber: "asc" }, { id: "asc" }], skip: (page - 1) * 100, take: 101 }),
    prisma.enrollment.findMany({ where: { schoolId, academicYearId, classId, feeAssignment: null, student: studentFilter }, include: { student: true }, orderBy: [{ student: { admissionNumber: "asc" } }, { id: "asc" }], skip: (page - 1) * 100, take: 101 }),
    prisma.classSection.findMany({ where: { schoolId, academicYearId, classId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.feePlan.findUnique({ where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId } }, include: { items: true } }),
  ]) : [[], [], [], null];
  const annualPaise = plan?.items.length ? plan.items.reduce((sum, item) => sum + item.amountPaise, 0) : null;
  const href = (nextPage: number) => `?${new URLSearchParams({ batchYearId: academicYearId, batchClassId: classId, batchSearch: search, batchPage: String(nextPage) })}#bulk-enrollment`;
  return <section id="bulk-enrollment" className="space-y-5 rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Bulk enrollment and fee assignment</h2><p className="text-sm text-slate-600">Choose an academic year and class, then select up to 100 records. Students without any earlier enrollment can be enrolled here. Each enrollment receives the full annual fee; concessions use discounts.</p>
    <form className="grid gap-4 sm:grid-cols-2">{[["batchYearId", "Academic year", years], ["batchClassId", "Class", classes]].map(([name, label, options]) => <label key={name as string}>{label as string}<select aria-label={label as string} required name={name as string} defaultValue={query[name as "batchYearId" | "batchClassId"]} className="mt-1 block w-full rounded border p-2"><option value="">Choose</option>{(options as { id: string; name: string }[]).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>)}<label>Student name or admission number<input name="batchSearch" defaultValue={search} maxLength={120} className="mt-1 block w-full rounded border p-2" /></label><Button>Preview enrollment and fees</Button></form>
    {ready && <><p className="text-sm">Annual fees per student: {annualPaise === null ? "Not configured. Ask the fee configurator to create this class plan." : displayMoney(annualPaise)}</p>
      <h3 className="font-semibold">Enroll existing students</h3><p className="text-sm text-slate-600">Only active students without an enrollment in the selected year are shown. Existing placements cannot be overwritten.</p><BatchStudentsForm key={`enroll-${JSON.stringify(query)}`} schoolId={schoolId} mode="enroll" students={students.slice(0, 100)} academicYearId={academicYearId} classId={classId} sections={sections} annualPaise={annualPaise} />
      <h3 id="bulk-fees" className="border-t pt-5 font-semibold">Assign configured fees</h3><p className="text-sm text-slate-600">Only enrollments in this class and year without a fee assignment are shown. Creating a fee plan also assigns it automatically to waiting enrollments.</p><BatchStudentsForm key={`fees-${JSON.stringify(query)}`} schoolId={schoolId} mode="fees" students={enrollments.slice(0, 100).map(item => ({ id: item.id, name: item.student.name, admissionNumber: item.student.admissionNumber }))} academicYearId={academicYearId} classId={classId} sections={[]} annualPaise={annualPaise} />
      <nav aria-label="Batch pages" className="flex items-center gap-4 text-sm text-indigo-700">{page > 1 && <Link href={href(page - 1)}>Previous page</Link>}<span>Page {page}</span>{(students.length > 100 || enrollments.length > 100) && <Link href={href(page + 1)}>Next page</Link>}</nav></>}
  </section>;
}
