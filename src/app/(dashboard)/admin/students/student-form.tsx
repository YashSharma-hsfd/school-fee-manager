"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addStudent, editStudent, type StudentFormState } from "@/actions/students";
import type { StudentInput } from "@/validators/student";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { FormFeedback } from "@/components/form-feedback";

const fields = [
  { name: "name", label: "Student name", max: 120 },
  { name: "admissionNumber", label: "Admission number", max: 40 },
  { name: "dateOfBirth", label: "Date of birth", max: 10 },
  { name: "admissionDate", label: "Admission date (optional)", max: 10 },
  { name: "guardianName", label: "Guardian name", max: 120 },
  { name: "guardianPhone", label: "Guardian phone", max: 30 },
] as const;
const empty: StudentInput = { name: "", admissionNumber: "", dateOfBirth: "", admissionDate: "", guardianName: "", guardianPhone: "" };

export function StudentForm({ schoolId, student }: { schoolId: string; student?: StudentInput & { id: string; updatedAt: string } }) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<StudentInput>(student ?? empty);
  const save = student ? editStudent.bind(null, student.id) : addStudent;
  const [state, action, pending] = useActionState(async (previous: StudentFormState, formData: FormData) => {
    const next = await save(previous, formData);
    if (next.success && !student) setValues(empty);
    return next;
  }, { error: "", success: "", fields: {} });
  return <form action={action} aria-busy={pending} className="space-y-5">
    <input type="hidden" name="schoolId" value={schoolId} />
    <fieldset disabled={pending || !hydrated} className="space-y-4">
      <legend className="mb-4 text-lg font-semibold">{student ? "Student details" : "Add student"}</legend>
      {!student && <p className="text-sm leading-relaxed text-slate-500">First save the student’s details. You’ll choose the academic year, class, section and roll number next.</p>}
      {student && <input type="hidden" name="updatedAt" value={student.updatedAt} />}
      {fields.map(field => <div key={field.name}>
        {field.name === "guardianName" && <h3 className="mb-4 border-t border-slate-100 pt-5 text-sm font-semibold">Primary guardian contact <span className="font-normal text-slate-400">(optional)</span></h3>}
        <label htmlFor={field.name} className="text-sm font-medium">{field.label}</label>
        <input id={field.name} name={field.name} type={field.name === "guardianPhone" ? "tel" : ["dateOfBirth", "admissionDate"].includes(field.name) ? "date" : "text"} required={["name", "admissionNumber", "dateOfBirth"].includes(field.name)} maxLength={field.max}
          value={values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
          aria-invalid={!!state.fields[field.name]} aria-describedby={state.fields[field.name] ? `${field.name}-error` : undefined}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 focus:outline-indigo-600" />
        {state.fields[field.name] && <p id={`${field.name}-error`} className="mt-1 text-sm text-red-700">{state.fields[field.name].join(" ")}</p>}
      </div>)}
      <Button type="submit" disabled={pending || !hydrated} className="w-full">{!hydrated ? "Loading form..." : pending ? "Saving..." : student ? "Save changes" : "Add student"}</Button>
    </fieldset>
    {student && <Link href="/admin/students" className="inline-block text-sm text-indigo-700">Cancel</Link>}
    <FormFeedback error={state.error} success={state.success}>{state.studentId && <Button asChild><Link href={`/schools/${schoolId}/students/${state.studentId}#enrollment`}>Continue to enrollment →</Link></Button>}</FormFeedback>
  </form>;
}
