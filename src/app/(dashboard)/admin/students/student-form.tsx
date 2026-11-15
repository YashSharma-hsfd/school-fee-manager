"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addStudent, editStudent, type StudentFormState } from "@/actions/students";
import type { StudentInput } from "@/validators/student";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

const fields = [
  { name: "name", label: "Student name", max: 120 },
  { name: "admissionNumber", label: "Admission number", max: 40 },
  { name: "className", label: "Class", max: 60 },
  { name: "guardianName", label: "Guardian name", max: 120 },
  { name: "guardianPhone", label: "Guardian phone", max: 30 },
] as const;
const empty: StudentInput = { name: "", admissionNumber: "", className: "", guardianName: "", guardianPhone: "" };

export function StudentForm({ schoolId, student }: { schoolId: string; student?: StudentInput & { id: string; updatedAt: string } }) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<StudentInput>(student ?? empty);
  const save = student ? editStudent.bind(null, student.id) : addStudent;
  const [state, action, pending] = useActionState(async (previous: StudentFormState, formData: FormData) => {
    const next = await save(previous, formData);
    if (next.success && !student) setValues(empty);
    return next;
  }, { error: "", success: "", fields: {} });
  return <form action={action} className="space-y-5">
    <input type="hidden" name="schoolId" value={schoolId} />
    <fieldset disabled={pending || !hydrated} className="space-y-4">
      <legend className="mb-4 text-lg font-semibold">{student ? "Student details" : "Add student"}</legend>
      {student && <input type="hidden" name="updatedAt" value={student.updatedAt} />}
      {fields.map(field => <div key={field.name}>
        <label htmlFor={field.name} className="text-sm font-medium">{field.label}</label>
        <input id={field.name} name={field.name} type={field.name === "guardianPhone" ? "tel" : "text"} required maxLength={field.max}
          value={values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
          aria-invalid={!!state.fields[field.name]} aria-describedby={state.fields[field.name] ? `${field.name}-error` : undefined}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 focus:outline-indigo-600" />
        {state.fields[field.name] && <p id={`${field.name}-error`} className="mt-1 text-sm text-red-700">{state.fields[field.name].join(" ")}</p>}
      </div>)}
      <Button type="submit" disabled={pending || !hydrated} className="w-full">{!hydrated ? "Loading form..." : pending ? "Saving..." : student ? "Save changes" : "Add student"}</Button>
    </fieldset>
    {student && <Link href="/admin/students" className="inline-block text-sm text-indigo-700">Cancel</Link>}
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
  </form>;
}
