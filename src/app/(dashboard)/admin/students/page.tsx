import { studentProfile, studentProfileInclude } from "@/services/student-profile";
import Link from "next/link";
import { studentWhere } from "@/services/report-filters";
import { studentFilterSchema, statusLabels } from "@/services/student-status";
import { z } from "zod";
import { activeSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { StudentForm } from "./student-form";

const querySchema = z.object({
  status: studentFilterSchema,
  className: z.string().trim().max(60).catch(""),
  q: z.string().trim().max(120).catch(""),
  saved: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
const pageSize = 20;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { school } = await activeSchool();
  const { q, page, saved, status, className } = querySchema.parse(await searchParams);
  const where = { schoolId: school.id, ...studentWhere({ q, className, lifecycle: status }) };
  let result;
  try {
    result = await prisma.$transaction(async tx => {
      const total = await tx.student.count({ where });
      const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
      const records = await tx.student.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * pageSize, take: pageSize,
        include: studentProfileInclude });
      const students = records.map(studentProfile);
      const classOptions = (await tx.schoolClass.findMany({ where: { schoolId: school.id }, orderBy: { name: "asc" } })).map(row => ({ className: row.name }));
      return { students, total, currentPage, classOptions };
    });
  } catch {
    return <main id="main-content" className="mx-auto max-w-6xl px-6 py-12"><h1 className="text-3xl font-semibold">Students</h1><p role="alert" className="mt-6">Student records are temporarily unavailable. Please try again later.</p></main>;
  }
  const href = (page: number) => `/admin/students?${new URLSearchParams({ q, status, className, page: String(page) })}`;
  return <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">
    <header className="mb-8"><h1 className="text-3xl font-semibold tracking-tight">Students</h1><p className="mt-2 text-slate-500">Manage student admissions and guardian contacts.</p></header>
    {saved && <p role="status" className="mb-6 text-sm text-green-700">Student updated successfully.</p>}
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6" aria-label="Student records">
        <form key={JSON.stringify({q,className,status})} className="flex flex-wrap items-end gap-3" action="/admin/students">
          <div className="grow"><label htmlFor="student-search" className="text-sm font-medium">Search students</label><input id="student-search" name="q" defaultValue={q} maxLength={120} placeholder="Name, admission, guardian name or phone" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 focus:outline-indigo-600" /></div>
          <label className="text-sm">Class<select name="className" defaultValue={className} className="ml-2 rounded border p-2"><option value="">All classes</option>{result.classOptions.map(item => <option key={item.className} value={item.className}>{item.className}</option>)}</select></label><label className="text-sm">Status<select name="status" defaultValue={status} className="ml-2 rounded border p-2">{[...Object.entries(statusLabels), ["ALL", "All statuses"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button type="submit">Search</Button>{q && <Link href="/admin/students" className="py-2 text-sm text-indigo-700">Clear</Link>}
        </form>
        <p className="my-5 text-sm text-slate-500">{result.total} {result.total === 1 ? "student" : "students"}{q ? " matching your search" : " registered"}</p>
        {result.students.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Student admission and guardian records</caption><thead className="border-b text-slate-500"><tr>{["Student", "Admission no.", "Class", "Status", "Guardian", "Actions"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{result.students.map(student => <tr key={student.id} className="border-b border-slate-100"><td className="px-3 py-4 font-medium">{student.name}</td><td className="px-3 py-4">{student.admissionNumber}</td><td className="px-3 py-4">{student.className}</td><td className="px-3 py-4">{statusLabels[student.status]}</td><td className="px-3 py-4"><p>{student.guardianName}</p><p className="mt-1 text-slate-500">{student.guardianPhone}</p></td><td className="px-3 py-4"><Link href={`/admin/students/${encodeURIComponent(student.id)}/edit`} aria-label={`Edit ${student.name}`} className="font-medium text-indigo-700">Edit</Link><Link href={`/schools/${school.id}/students/${student.id}`} className="ml-3 text-indigo-700">Account / status</Link></td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-slate-50 p-6 text-slate-600">{q ? "No students match your search." : "No students yet. Add your first student using the form."}</p>}
        <nav aria-label="Student pages" className="mt-5 flex items-center justify-between text-sm">
          {result.currentPage > 1 ? <Link href={href(result.currentPage - 1)} className="text-indigo-700">Previous</Link> : <span />}
          <span>Page {result.currentPage} of {Math.max(1, Math.ceil(result.total / pageSize))}</span>
          {result.currentPage * pageSize < result.total ? <Link href={href(result.currentPage + 1)} className="text-indigo-700">Next</Link> : <span />}
        </nav>
      </section>
      <section id="add-student" className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm"><StudentForm schoolId={school.id} /></section>
    </div>
  </main>;
}
