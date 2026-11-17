"use client";
import { useState } from "react";
import { assignFees, enrollStudents } from "@/actions/operations";
import { SchoolForm } from "./school-forms";
import { displayMoney } from "@/services/fee-calculations";

type Item = { id: string; name: string; admissionNumber: string };
export function BatchStudentsForm({ schoolId, mode, students, academicYearId, classId, sections, annualPaise }: {
  schoolId: string; mode: "enroll" | "fees"; students: Item[]; academicYearId: string; classId: string;
  sections: { id: string; name: string }[]; annualPaise: number | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const count = students.filter(student => selected.includes(student.id)).length;
  return <SchoolForm action={(mode === "enroll" ? enrollStudents : assignFees).bind(null, schoolId)}
    submit={mode === "enroll" ? "Enroll selected students" : "Assign fees to selected students"} submitDisabled={!count || (mode === "fees" && annualPaise === null)} fields={mode === "enroll" ? [
      { name: "academicYearId", label: "", type: "hidden", value: academicYearId },
      { name: "classId", label: "", type: "hidden", value: classId },
      { name: "sectionId", label: "Section", required: false, options: [{ value: "", label: "No section" }, ...sections.map(section => ({ value: section.id, label: section.name }))], help: "Use a separate batch for each section. Roll numbers are optional and entered individually below." },
      { name: "startsOn", label: "Enrollment date", type: "date", required: false, help: "Leave blank to use the later of admission date and academic-year start. Full annual fees apply." },
    ] : []}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">{count} of {students.length} selected</p>{!!students.length && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={count === students.length} onChange={event => setSelected(event.target.checked ? students.map(student => student.id) : [])} />Select all shown</label>}</div>
    <fieldset className="max-h-80 space-y-1 overflow-auto rounded-xl border border-slate-200 p-3"><legend className="sr-only">{mode === "enroll" ? "Students to enroll" : "Enrollments to assign fees"}</legend>{students.map(student => <div key={student.id} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-slate-50"><label className="flex flex-1 cursor-pointer items-start gap-3"><input type="checkbox" name={mode === "enroll" ? "studentIds" : "enrollmentIds"} value={student.id} checked={selected.includes(student.id)} onChange={event => setSelected(current => event.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))} /><span><span className="font-medium">{student.name}</span><span className="mt-1 block font-mono text-xs text-slate-500">{student.admissionNumber}</span></span></label>{mode === "enroll" && <label className="text-xs">Roll number for {student.name}<input name={`roll:${student.id}`} disabled={!selected.includes(student.id)} maxLength={40} className="mt-1 block w-32 rounded border p-2" /></label>}</div>)}{!students.length && <p className="p-4 text-sm text-slate-500">No matching records remain on this page.</p>}</fieldset>
    {!!count && <p aria-live="polite" className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm">{annualPaise === null ? "Fees are not configured. Enrollment can proceed; ask the fee configurator to create a class plan before collection." : `Full annual fees for this selection: ${displayMoney(annualPaise * count)}. Existing charges and earlier dues are preserved. Use discounts for concessions.`}</p>}
  </SchoolForm>;
}
