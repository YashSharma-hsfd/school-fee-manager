import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { selectSchool } from "@/actions/schools";

export async function SetupChecklist({ schoolId }: { schoolId: string }) {
  const [years, classes, plans, students] = await Promise.all([
    prisma.academicYear.count({ where: { schoolId } }), prisma.schoolClass.count({ where: { schoolId } }),
    prisma.feePlan.count({ where: { schoolId } }), prisma.student.count({ where: { schoolId } }),
  ]);
  const steps = [
    { title: "Academic year", detail: "Set the session’s start and end dates.", count: years, anchor: "academic-setup" },
    { title: "Classes & sections", detail: "Add classes, then any year-specific sections.", count: classes, anchor: "classes" },
    { title: "Class fees", detail: "Choose annual fees and installment dates.", count: plans, anchor: "fee-plans" },
    { title: "Student records", detail: "Add a student and continue to enrollment.", count: students, anchor: "students" },
  ];
  const completed = steps.filter(step => step.count > 0).length;
  if (completed === steps.length) return null;
  return <section aria-label="School setup checklist" className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Get your school ready</h2><p className="mt-1 text-sm text-slate-500">Complete these setup tasks. You can add students before configuring fees.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">{completed} of 4 ready</span></div><ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step.title} className={`rounded-xl border p-4 ${step.count ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}><p className="mb-3 text-xs font-semibold text-slate-500">{step.count ? "✓ Ready" : `Step ${index + 1}`}</p><h3 className="font-semibold">{step.title}</h3><p className="mb-4 mt-2 min-h-10 text-xs leading-relaxed text-slate-500">{step.detail}</p>{step.anchor === "students" ? <form action={selectSchool.bind(null, schoolId, "students")}><button className="text-sm font-semibold text-indigo-700">{step.count ? "Manage students" : "Add a student"} →</button></form> : <Link className="text-sm font-semibold text-indigo-700" href={`/schools/${schoolId}/settings#${step.anchor}`}>{step.count ? "Review setup" : "Set up"} →</Link>}</li>)}</ol></section>;
}
