import Link from "next/link";
import type { SchoolAccess } from "@/services/school-permissions";
import type { StaffRole } from "@/services/auth";
import { studentWhere } from "@/services/report-filters";
import { studentFilterSchema, statusLabels } from "@/services/student-status";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assignUnassignedStudent } from "@/actions/schools";
import { SchoolForm } from "@/components/school-forms";

export async function StudentDirectory({ schoolId, membership, globalRole, searchParams, basePath }: { schoolId: string; membership: SchoolAccess; globalRole: StaffRole; searchParams: Record<string, string | string[] | undefined>; basePath: string }) {
  const { q, page, status, className } = z.object({ className: z.string().trim().max(60).catch(""), status: studentFilterSchema, q: z.string().trim().max(120).catch(""), page: z.coerce.number().int().min(1).max(100000).catch(1) }).parse(await searchParams);
  const where = { schoolId, ...studentWhere({ q, className, lifecycle: status }) };
  const [students, total, unassigned, classOptions] = await Promise.all([
    prisma.student.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * 30, take: 30 }), prisma.student.count({ where }),
    globalRole === "ADMIN" && membership.role === "ADMIN" ? prisma.student.findMany({ where: { schoolId: null }, select: { id: true, name: true, admissionNumber: true }, take: 100, orderBy: { name: "asc" } }) : [],
    prisma.student.groupBy({ by: ["className"], where: { schoolId }, orderBy: { className: "asc" } }),
  ]);
  return <section aria-label="Student account search" className="space-y-4">
    <h2 id="student-search" className="mt-8 text-xl font-semibold">Find student accounts</h2>
    <form key={JSON.stringify({q,className,status})} className="my-6 flex flex-wrap gap-3"><label htmlFor="q" className="sr-only">Find student</label><input id="q" name="q" defaultValue={q} maxLength={120} placeholder="Name, admission, guardian name or phone" className="w-full max-w-md rounded-md border px-3 py-2" /><label htmlFor="student-class" className="sr-only">Class</label><select id="student-class" name="className" defaultValue={className} className="rounded-md border px-3 py-2"><option value="">All classes</option>{classOptions.map(item => <option key={item.className} value={item.className}>{item.className}</option>)}</select><label className="sr-only" htmlFor="student-status">Student status</label><select id="student-status" name="status" defaultValue={status} className="rounded-md border px-3 py-2">{[...Object.entries(statusLabels), ["ALL", "All statuses"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-md bg-slate-900 px-4 py-2 text-white">Search</button><Link href={`${basePath}#student-search`} className="rounded-md border bg-white px-3 py-2 text-indigo-700">Clear filters</Link></form>
    <p className="mb-4 text-sm text-slate-500">{total} students</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Student</th><th className="p-4">Admission number</th><th className="p-4">Class</th><th className="p-4">Status</th><th className="p-4">Fees</th></tr></thead><tbody>{students.map(student => <tr key={student.id} className="border-b"><td className="p-4">{student.name}</td><td className="p-4">{student.admissionNumber}</td><td className="p-4">{student.className}</td><td className="p-4">{statusLabels[student.status]}</td><td className="p-4"><Link className="text-indigo-700" href={`/schools/${schoolId}/students/${student.id}`}>View account</Link></td></tr>)}</tbody></table>{!students.length && <p className="p-6 text-slate-500">No students found. Administration staff can add students from Student records.</p>}</div>
    <nav aria-label="Student pages" className="mt-5 flex gap-6 text-sm">{page > 1 && <Link href={`?${new URLSearchParams({ q, status, className, page: String(page - 1) })}`}>Previous</Link>}{page * 30 < total && <Link href={`?${new URLSearchParams({ q, status, className, page: String(page + 1) })}`}>Next</Link>}</nav>
    {!!unassigned.length && <section className="mt-8 max-w-xl rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Assign existing student to this school</h2><p className="mb-4 text-sm text-slate-500">These records were created before schools were added. Confirm ownership before assigning. Showing up to 100 at a time; assigned records leave this list.</p><SchoolForm action={assignUnassignedStudent.bind(null, schoolId)} submit="Assign to this school" fields={[{ name: "studentId", label: "Unassigned student", options: unassigned.map(student => ({ value: student.id, label: `${student.admissionNumber} — ${student.name}` })) }]} /></section>}
  </section>;
}
