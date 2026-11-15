import Link from "next/link";
import { z } from "zod";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { assignUnassignedStudent } from "@/actions/schools";
import { SchoolForm } from "@/components/school-forms";

export default async function SchoolPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { schoolId } = await params;
  const { school, membership, user } = await schoolAccess(schoolId);
  const { q, page } = z.object({ q: z.string().trim().max(120).catch(""), page: z.coerce.number().int().min(1).max(100000).catch(1) }).parse(await searchParams);
  const where = { schoolId, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { admissionNumber: { contains: q, mode: "insensitive" as const } }] } : {}) };
  const [students, total, unassigned] = await Promise.all([
    prisma.student.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * 30, take: 30 }), prisma.student.count({ where }),
    user.role === "ADMIN" && membership.role === "ADMIN" ? prisma.student.findMany({ where: { schoolId: null }, select: { id: true, name: true, admissionNumber: true }, take: 100, orderBy: { name: "asc" } }) : [],
  ]);
  return <main className="mx-auto max-w-6xl px-6 py-10">
    <h1 className="text-3xl font-semibold">{school.name}</h1><p className="mt-2 text-slate-500">Find a student to view fees, academic-year records, payments and receipts.</p>
    <form className="my-6 flex gap-3"><label htmlFor="q" className="sr-only">Find student</label><input id="q" name="q" defaultValue={q} maxLength={120} placeholder="Student name or admission number" className="w-full max-w-md rounded-md border px-3 py-2" /><button className="rounded-md bg-slate-900 px-4 py-2 text-white">Search</button></form>
    <p className="mb-4 text-sm text-slate-500">{total} students</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Student</th><th className="p-4">Admission number</th><th className="p-4">Class</th><th className="p-4">Fees</th></tr></thead><tbody>{students.map(student => <tr key={student.id} className="border-b"><td className="p-4">{student.name}</td><td className="p-4">{student.admissionNumber}</td><td className="p-4">{student.className}</td><td className="p-4"><Link className="text-indigo-700" href={`/schools/${schoolId}/students/${student.id}`}>View account</Link></td></tr>)}</tbody></table>{!students.length && <p className="p-6 text-slate-500">No students found. Administration staff can add students from Student records.</p>}</div>
    <nav aria-label="Student pages" className="mt-5 flex gap-6 text-sm">{page > 1 && <Link href={`?${new URLSearchParams({ q, page: String(page - 1) })}`}>Previous</Link>}{page * 30 < total && <Link href={`?${new URLSearchParams({ q, page: String(page + 1) })}`}>Next</Link>}</nav>
    {!!unassigned.length && <section className="mt-8 max-w-xl rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Assign existing student to this school</h2><p className="mb-4 text-sm text-slate-500">These records were created before schools were added. Confirm ownership before assigning. Showing up to 100 at a time; assigned records leave this list.</p><SchoolForm action={assignUnassignedStudent.bind(null, schoolId)} submit="Assign to this school" fields={[{ name: "studentId", label: "Unassigned student", options: unassigned.map(student => ({ value: student.id, label: `${student.admissionNumber} — ${student.name}` })) }]} /></section>}
  </main>;
}
