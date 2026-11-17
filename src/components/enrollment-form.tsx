"use client";
import { useActionState, useId, useState } from "react";
import { enroll } from "@/actions/schools";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "./ui/button";
import { FormFeedback } from "./form-feedback";

type Year = { id: string; name: string; startsOn: string; endsOn: string };
type Props = { schoolId: string; studentId: string; today: string; years: Year[]; classes: { id: string; name: string }[]; sections: { id: string; name: string; academicYearId: string; classId: string }[]; enrollments: { academicYearId: string; classId: string; sectionId: string | null }[]; plans: { academicYearId: string; classId: string }[] };
const control = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function EnrollmentForm({ schoolId, studentId, today, years, classes, sections, enrollments, plans }: Props) {
  const id = useId(), hydrated = useHydrated();
  const firstYear = years.find(year => year.startsOn <= today && year.endsOn >= today) ?? years[0];
  const [yearId, setYearId] = useState(firstYear?.id ?? "");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [startsOn, setStartsOn] = useState(firstYear?.startsOn ?? "");
  const [state, action, pending] = useActionState(enroll.bind(null, schoolId, studentId), { error: "", success: "" });
  const year = years.find(item => item.id === yearId);
  const existing = enrollments.find(item => item.academicYearId === yearId);
  const options = sections.filter(section => section.academicYearId === yearId && section.classId === classId);
  const hasPlan = plans.some(plan => plan.academicYearId === yearId && plan.classId === classId);
  return <form action={action} aria-busy={pending} className="space-y-5"><fieldset disabled={pending || !hydrated} className="space-y-4">
    <label className="block text-sm font-medium" htmlFor={`${id}-year`}>Academic year<select id={`${id}-year`} name="academicYearId" required value={yearId} className={control} onChange={event => { setYearId(event.target.value); setClassId(""); setSectionId(""); setStartsOn(years.find(item => item.id === event.target.value)?.startsOn ?? ""); }}>{years.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {existing ? <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm"><p className="font-semibold">Already enrolled in {classes.find(item => item.id === existing.classId)?.name ?? "this academic year"}{existing.sectionId ? ` · ${sections.find(section => section.id === existing.sectionId)?.name ?? ""}` : ""}</p><p className="mt-2 text-slate-600">Class and section remain fixed for this year. Choose a later academic year to promote this student.</p><a href="#academic-history" className="mt-3 inline-block font-medium text-indigo-700">View academic history →</a></div> : <>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium" htmlFor={`${id}-class`}>Class<select id={`${id}-class`} name="classId" required value={classId} className={control} onChange={event => { setClassId(event.target.value); setSectionId(""); }}><option value="">Choose a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium" htmlFor={`${id}-section`}>Section <span className="font-normal text-slate-400">(optional)</span><select id={`${id}-section`} name="sectionId" disabled={!classId || !options.length} value={sectionId} className={control} onChange={event => setSectionId(event.target.value)}><option value="">{classId && !options.length ? "No sections configured" : "No section"}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <label className="block text-sm font-medium" htmlFor={`${id}-roll`}>Roll number <span className="font-normal text-slate-400">(optional)</span><input id={`${id}-roll`} name="rollNumber" maxLength={40} placeholder="e.g. 001" className={control} /><span className="mt-1 block text-xs font-normal text-slate-500">Unique within this year, class and section; it may change next year.</span></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium" htmlFor={`${id}-start`}>Enrollment starts on<input id={`${id}-start`} name="startsOn" type="date" required min={year?.startsOn} max={year?.endsOn} value={startsOn} onChange={event => setStartsOn(event.target.value)} className={control} /></label><label className="text-sm font-medium" htmlFor={`${id}-end`}>Enrollment ends on <span className="font-normal text-slate-400">(optional)</span><input id={`${id}-end`} name="endsOn" type="date" min={startsOn || year?.startsOn} max={year?.endsOn} className={control} /></label></div>
      {!!classId && <p className={`rounded-xl border p-4 text-sm ${hasPlan ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{hasPlan ? "Class fees are ready and will be assigned when you save. Earlier dues remain." : "Fees not configured for this class and year. You can save the enrollment now, then ask the fee configurator to prepare the plan."}</p>}
      <Button type="submit" disabled={pending || !hydrated || !classId} className="w-full sm:w-auto">{pending ? "Saving…" : "Save academic-year record"}</Button>
    </>}
  </fieldset><FormFeedback error={state.error} success={state.success} /></form>;
}
