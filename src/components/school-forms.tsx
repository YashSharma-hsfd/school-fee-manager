"use client";
import { useActionState, useId, useState, type ReactNode } from "react";
import type { SchoolFormState } from "@/actions/schools";
import { Button } from "./ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

export type FormField = { name: string; label: string; type?: string; value?: string; options?: { value: string; label: string }[]; required?: boolean; min?: string; max?: string; help?: string };
type Props = { action: (state: SchoolFormState, data: FormData) => Promise<SchoolFormState>; fields: FormField[]; submit: string; children?: ReactNode };
const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-indigo-600";

export function SchoolForm({ action, fields, submit, children }: Props) {
  const formId = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => [field.name, field.value ?? (field.options?.[0]?.value || "")])));
  const [state, dispatch, pending] = useActionState(async (previous: SchoolFormState, data: FormData) => {
    const result = await action(previous, data);
    if (result.success) setValues(current => Object.fromEntries(Object.entries(current).map(([name, value]) => [name, fields.find(field => field.name === name)?.type === "password" ? "" : value])));
    return result;
  }, { error: "", success: "" });
  return <form action={dispatch} className="space-y-4">
    <fieldset disabled={pending || !hydrated} className="space-y-4">
      {fields.map(field => <div key={field.name} hidden={field.type === "hidden"}>
        {field.type !== "hidden" && <label htmlFor={`${formId}-${field.name}`} className="text-sm font-medium">{field.label}</label>}
        {field.options ? <select id={`${formId}-${field.name}`} name={field.name} required={field.required !== false} value={values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} className={inputClass}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.type === "checkbox" ? <input id={`${formId}-${field.name}`} name={field.name} type="checkbox" checked={values[field.name] === "on"} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.checked ? "on" : "" }))} className="ml-3" />
          : <input id={`${formId}-${field.name}`} name={field.name} type={field.type || "text"} required={field.type !== "hidden" && field.required !== false} min={field.min} max={field.max} maxLength={field.type === "text" || !field.type ? 500 : undefined} value={field.type === "hidden" ? field.value || "" : values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} className={inputClass} />}
        {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
      </div>)}
      {children}
      <Button type="submit" disabled={pending || !hydrated}>{!hydrated ? "Loading form..." : pending ? "Saving..." : submit}</Button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
  </form>;
}

export function FeePlanForm({ action, years, classes }: { action: Props["action"]; years: { value: string; label: string }[]; classes: { value: string; label: string }[] }) {
  const [components, setComponents] = useState([{ name: "", amount: "" }]);
  return <SchoolForm action={action} submit="Create class fee plan" fields={[
    { name: "academicYearId", label: "Academic year", options: years },
    { name: "classId", label: "Class", options: classes },
    { name: "frequency", label: "Due-date schedule", options: [{ value: "MONTHLY", label: "Monthly (12 installments)" }, { value: "QUARTERLY", label: "Quarterly (4 installments)" }, { value: "ANNUAL", label: "Annual (1 installment)" }] },
    { name: "firstDueOn", label: "First due date", type: "date", help: "Choose a day from 1–28. All installments must fall within the academic year. Payments can be any amount." },
  ]}>
    <input type="hidden" name="components" value={JSON.stringify(components)} />
    <p className="text-sm font-medium">Annual fees by component</p>
    {components.map((component, index) => <div key={index} className="grid grid-cols-2 gap-3">
      <div><label htmlFor={`component-${index}`} className="text-xs">Fee name {index + 1}</label><input id={`component-${index}`} required maxLength={100} value={component.name} onChange={event => setComponents(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} className={inputClass} /></div>
      <div><label htmlFor={`amount-${index}`} className="text-xs">Annual amount {index + 1}</label><input id={`amount-${index}`} required inputMode="decimal" value={component.amount} onChange={event => setComponents(current => current.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} className={inputClass} /></div>
    </div>)}
    <div className="flex gap-3"><Button type="button" variant="outline" disabled={components.length >= 30} onClick={() => setComponents(current => [...current, { name: "", amount: "" }])}>Add fee component</Button>{components.length > 1 && <Button type="button" variant="outline" onClick={() => setComponents(current => current.slice(0, -1))}>Remove last</Button>}</div>
    <p className="text-xs text-slate-500">The annual total is split exactly across due dates. Plans are fixed once created to preserve assigned fees.</p>
  </SchoolForm>;
}

export function PrintReceipt() { return <Button onClick={() => window.print()} className="print:hidden">Print receipt</Button>; }
