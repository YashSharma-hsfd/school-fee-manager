import Link from "next/link";
import type { SchoolAccess } from "@/services/school-permissions";
import type { StaffRole } from "@/services/auth";
import { studentWhere } from "@/services/report-filters";
import { studentFilterSchema, statusLabels } from "@/services/student-status";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { selectSchool } from "@/actions/schools";
import { Button } from "@/components/ui/button";
import { studentProfile, studentProfileInclude } from "@/services/student-profile";


export async function StudentDirectory({ schoolId, membership, searchParams, basePath }: { schoolId: string; membership: SchoolAccess; globalRole: StaffRole; searchParams: Record<string, string | string[] | undefined>; basePath: string }) {
  const { q, page, status, className } = z.object({ className: z.string().trim().max(60).catch(""), status: studentFilterSchema, q: z.string().trim().max(120).catch(""), page: z.coerce.number().int().min(1).max(100000).catch(1) }).parse(searchParams);
  const where = { schoolId, ...studentWhere({ q, className, lifecycle: status }) };
  const [total, classOptions] = await Promise.all([prisma.student.count({ where }), prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } })]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 30)));
  const records = await prisma.student.findMany({ where, include: studentProfileInclude, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (currentPage - 1) * 30, take: 30 });
  const students = records.map(studentProfile);
  const filtered = !!q || !!className || status !== "ACTIVE";
  const href = (page: number) => `?${new URLSearchParams({ q, status, className, page: String(page) })}#student-search`;
  const control = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  return <section aria-label="Student account search" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="student-search" className="text-xl font-semibold">Find student accounts</h2><p className="mt-1 text-sm text-slate-500">Search by student, admission number or any guardian contact.</p></div>{membership.role === "ADMIN" && <form action={selectSchool.bind(null, schoolId, "students")}><Button><span aria-hidden="true">+</span> Add student</Button></form>}</div>
    <form key={JSON.stringify({ q, className, status })} className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
      <label htmlFor="q" className="text-sm font-medium">Find student<input id="q" name="q" defaultValue={q} maxLength={120} placeholder="Name, admission number or guardian phone" className={control} /></label>
      <label htmlFor="student-class" className="text-sm font-medium">Class<select id="student-class" name="className" defaultValue={className} className={control}><option value="">All classes</option>{classOptions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label htmlFor="student-status" className="text-sm font-medium">Student status<select id="student-status" name="status" defaultValue={status} className={control}>{[...Object.entries(statusLabels), ["ALL", "All statuses"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="flex min-h-11 items-center gap-3"><Button type="submit">Search</Button>{filtered && <Link href={`${basePath}#student-search`} className="text-sm font-medium text-indigo-700">Clear filters</Link>}</div>
      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">Class searches include historical enrollments. Student status defaults to Active; choose All statuses to find former students.</p>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="font-medium text-slate-700">{total} {total === 1 ? "student" : "students"}{filtered ? " matching your filters" : " active"}</p>{total > 0 && <p className="text-slate-500">Showing {(currentPage - 1) * 30 + 1}–{Math.min(currentPage * 30, total)}</p>}</div>
    {students.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Students in this school matching your search</caption><thead className="border-b bg-slate-50"><tr>{["Student", "Admission number", "Latest class", "Status", "Account"].map(label => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{students.map(student => <tr key={student.id} className="border-b border-slate-100 last:border-0"><td className="px-5 py-4"><Link className="font-semibold text-slate-900 decoration-indigo-200 hover:text-indigo-700" href={`/schools/${schoolId}/students/${student.id}`}>{student.name}</Link><p className="mt-1 text-xs text-slate-500">{student.guardianPhone || "No primary contact added"}</p></td><td className="px-5 py-4 font-mono text-xs">{student.admissionNumber}</td><td className="px-5 py-4">{student.className}</td><td className="px-5 py-4"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${student.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{statusLabels[student.status]}</span></td><td className="px-5 py-4">{!student.enrollments[0]?.feeAssignment && <p className="mb-2 text-xs font-medium text-amber-800">Fees not configured</p>}<Link className="whitespace-nowrap font-semibold text-indigo-700" href={`/schools/${schoolId}/students/${student.id}`}>View account <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><h3 className="text-lg font-semibold">{filtered ? "No matching students" : "No active students yet"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{filtered ? "Try a different name or admission number, or include all student statuses." : "Add a student to start their academic record and fee account."}</p>{filtered ? <Button asChild variant="outline" className="mt-5"><Link href={basePath}>Clear filters</Link></Button> : membership.role === "ADMIN" ? <form action={selectSchool.bind(null, schoolId, "students")} className="mt-5"><Button>Add your first student</Button></form> : <p className="mt-4 text-sm text-slate-500">Ask administration to add or import student records.</p>}</div>}
    {total > 30 && <nav aria-label="Student pages" className="flex items-center justify-between gap-3 text-sm">{currentPage > 1 ? <Button asChild variant="outline"><Link href={href(currentPage - 1)}>← Previous</Link></Button> : <span />}<span className="text-slate-500">Page {currentPage} of {Math.ceil(total / 30)}</span>{currentPage * 30 < total ? <Button asChild variant="outline"><Link href={href(currentPage + 1)}>Next →</Link></Button> : <span />}</nav>}
  </section>;
}
