"use client";
import { useState } from "react";
import { promoteStudents } from "@/actions/operations";
import { displayMoney } from "@/services/fee-calculations";
import { SchoolForm } from "./school-forms";

export function PromotionForm({ schoolId, query, students, sections, annualPaise }: { schoolId: string; query: Record<string, string>; students: { id: string; name: string; admissionNumber: string }[]; sections: { id: string; name: string }[]; annualPaise: number | null }) {
  const [selected, setSelected] = useState<string[]>([]);
  const count = students.filter(student => selected.includes(student.id)).length;
  return <SchoolForm action={promoteStudents.bind(null, schoolId)} submit="Confirm promotion of selected students" submitDisabled={!count} fields={[
    ...Object.entries(query).filter(([name]) => name !== "sectionId").map(([name, value]) => ({ name, label: "", type: "hidden", value })),
    { name: "sectionId", label: "Destination section", required: false, options: [{ value: "", label: "No section" }, ...sections.map(section => ({ value: section.id, label: section.name }))], help: "The same section is used for everyone selected. Promote different sections in separate batches. Class and section cannot change within the year." },
  ]}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">{count} of {students.length} students selected</p>{students.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={count === students.length} onChange={event => setSelected(event.target.checked ? students.map(student => student.id) : [])} />Select all shown</label>}</div>
    <fieldset className="max-h-80 space-y-1 overflow-auto rounded-xl border border-slate-200 p-3"><legend className="sr-only">Select students for promotion</legend>{students.map(student => <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-sm hover:bg-slate-50"><input type="checkbox" name="studentIds" value={student.id} className="mt-0.5" checked={selected.includes(student.id)} onChange={event => setSelected(current => event.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))} /><span><span className="font-medium">{student.name}</span><span className="mt-1 block font-mono text-xs text-slate-500">{student.admissionNumber}</span></span></label>)}{!students.length && <p className="p-4 text-sm text-slate-500">No eligible students remain in this source class. Students already enrolled in the destination year are excluded.</p>}</fieldset>
    {!!count && <div aria-live="polite" className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm"><p className="font-semibold">Review before saving</p><p className="mt-2">{count} new academic-year records will be created. Previous records and unpaid dues remain.</p><p className="mt-2">{annualPaise === null ? "Destination fees are not configured. Enrollments will be flagged until a class fee plan is created." : `New class fees for selected students: ₹${displayMoney(annualPaise * count)}. This is a charge, not a collected payment.`}</p></div>}
  </SchoolForm>;
}
