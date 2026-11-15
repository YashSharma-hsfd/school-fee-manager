import { notFound } from "next/navigation";
import { activeSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { StudentForm } from "../../student-form";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { school } = await activeSchool();
  const { id } = await params;
  if (!id || id.length > 128) notFound();
  const student = await prisma.student.findFirst({
    where: { id, schoolId: school.id },
    select: { id: true, name: true, admissionNumber: true, className: true, guardianName: true, guardianPhone: true, updatedAt: true },
  });
  if (!student) notFound();
  return <main className="mx-auto max-w-2xl px-6 py-12">
    <header className="mb-8"><h1 className="text-3xl font-semibold tracking-tight">Edit student</h1><p className="mt-2 text-slate-500">Update admission details and guardian contacts.</p></header>
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <StudentForm schoolId={school.id} student={{ ...student, updatedAt: student.updatedAt.toISOString() }} />
    </section>
  </main>;
}
