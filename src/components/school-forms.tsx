"use client";
import { useActionState, useId, useState, type ReactNode } from "react";
import type { SchoolFormState } from "@/actions/schools";
import { Button } from "./ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { moneySchema, displayMoney } from "@/services/fee-calculations";
import { FormFeedback } from "./form-feedback";

export type FormField = { name: string; label: string; type?: string; value?: string; options?: { value: string; label: string }[]; required?: boolean; min?: string; max?: string; help?: string; placeholder?: string };
type Props = { action: (state: SchoolFormState, data: FormData) => Promise<SchoolFormState>; fields: FormField[]; submit: string; children?: ReactNode | ((values: Record<string, string>) => ReactNode); submitDisabled?: boolean; confirmation?: string; variant?: "default" | "outline" | "danger"; financialSummary?: { outstandingPaise: number; kind: "payment" | "discount" } };
const inputClass = "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-indigo-600";

export function SchoolForm({ action, fields, submit, children, submitDisabled, variant, financialSummary, confirmation }: Props) {
  const formId = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => [field.name, field.value ?? (field.options?.[0]?.value || "")])));
  const [state, dispatch, pending] = useActionState(async (previous: SchoolFormState, data: FormData) => {
    const result = await action(previous, data);
    if (result.success) setValues(current => Object.fromEntries(Object.entries(current).map(([name, value]) => [name, fields.find(field => field.name === name)?.type === "password" ? "" : value])));
    return result;
  }, { error: "", success: "" });
  const amount = financialSummary ? moneySchema.safeParse(values.amount ?? "") : null;
  const overLimit = amount?.success && financialSummary && amount.data > financialSummary.outstandingPaise;
  return <form action={dispatch} onSubmit={event => { if (confirmation && !window.confirm(confirmation)) event.preventDefault(); }} aria-busy={pending} className="space-y-5">
    <fieldset disabled={pending || !hydrated} className="space-y-4">
      {fields.map(field => <div key={field.name} hidden={field.type === "hidden"}>
        {field.type !== "hidden" && <label htmlFor={`${formId}-${field.name}`} className="text-sm font-medium text-slate-800">{field.label}{field.required === false && field.type !== "checkbox" && <span aria-hidden="true" className="ml-2 text-xs font-normal text-slate-400">Optional</span>}</label>}
        {field.options ? <select id={`${formId}-${field.name}`} name={field.name} aria-describedby={field.help ? `${formId}-${field.name}-help` : undefined} required={field.required !== false} value={values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} className={inputClass}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.type === "checkbox" ? <input id={`${formId}-${field.name}`} name={field.name} type="checkbox" checked={values[field.name] === "on"} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.checked ? "on" : "" }))} className="ml-3" />
          : <input id={`${formId}-${field.name}`} name={field.name} type={field.type || "text"} aria-describedby={field.help ? `${formId}-${field.name}-help` : undefined} placeholder={field.placeholder ?? (field.name === "amount" ? "e.g. 1250.50" : undefined)} inputMode={field.name === "amount" ? "decimal" : undefined} autoComplete={field.type === "password" ? (field.name === "currentPassword" ? "current-password" : "new-password") : undefined} required={field.type !== "hidden" && field.required !== false} min={field.min} max={field.max} maxLength={field.type === "text" || !field.type ? 500 : undefined} value={field.type === "hidden" ? field.value || "" : values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} className={inputClass} />}
        {field.help && <p id={`${formId}-${field.name}-help`} className="mt-2 text-xs leading-relaxed text-slate-500">{field.help}</p>}
      </div>)}
      {typeof children === "function" ? children(values) : children}
      {financialSummary && <div aria-live="polite" className={`rounded-xl border p-4 text-sm ${overLimit ? "border-red-200 bg-red-50" : "border-indigo-100 bg-indigo-50/60"}`}><div className="flex justify-between gap-3"><span>Current outstanding</span><strong>₹{displayMoney(financialSummary.outstandingPaise)}</strong></div>{amount?.success && !overLimit && <div className="mt-3 flex justify-between gap-3 border-t border-indigo-100 pt-3"><span>After this {financialSummary.kind}</span><strong>₹{displayMoney(financialSummary.outstandingPaise - amount.data)}</strong></div>}{overLimit && <p className="mt-2 text-red-800">Enter an amount no higher than the outstanding balance.</p>}<p className="mt-3 text-xs text-slate-600">Oldest unpaid charges are settled first. The final balance is checked again when you save.</p></div>}
      <Button type="submit" variant={variant} disabled={pending || !hydrated || submitDisabled} className="w-full sm:w-auto">{!hydrated ? "Preparing form…" : pending ? "Saving…" : submit}</Button>
    </fieldset>
    <FormFeedback error={state.error} success={state.success} />
  </form>;
}

export function FeePlanForm({ action, years, classes }: { action: Props["action"]; years: { value: string; label: string }[]; classes: { value: string; label: string }[] }) {
  const componentId = useId();
  const [components, setComponents] = useState([{ name: "", amount: "" }]);
  const amounts = components.map(component => moneySchema.safeParse(component.amount));
  const annualTotal = amounts.every(amount => amount.success) ? amounts.reduce((sum, amount) => sum + (amount.success ? amount.data : 0), 0) : null;
  return <SchoolForm action={action} submit="Create class fee plan" fields={[
    { name: "academicYearId", label: "Academic year", options: years },
    { name: "classId", label: "Class", options: classes },
    { name: "frequency", label: "Due-date schedule", options: [{ value: "MONTHLY", label: "Monthly (12 installments)" }, { value: "QUARTERLY", label: "Quarterly (4 installments)" }, { value: "ANNUAL", label: "Annual (1 installment)" }] },
    { name: "firstDueOn", label: "First due date", type: "date", help: "Choose a day from 1–28. All installments must fit within the academic year." },
  ]}>{values => <>
    <input type="hidden" name="components" value={JSON.stringify(components)} />
    <div className="border-t border-slate-100 pt-5"><h3 className="font-semibold">Annual fees by component</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Enter the full year’s amount in rupees for each fee, even when collecting monthly.</p></div>
    {components.map((component, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fee {index + 1}</span>{components.length > 1 && <button type="button" aria-label={`Remove fee ${index + 1}`} className="text-xs font-medium text-red-700" onClick={() => setComponents(current => current.filter((_, i) => i !== index))}>Remove</button>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor={`${componentId}-component-${index}`} className="text-sm font-medium">Fee name {index + 1}</label><input id={`${componentId}-component-${index}`} required maxLength={100} placeholder="e.g. Tuition" value={component.name} onChange={event => setComponents(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} className={inputClass} /></div>
      <div><label htmlFor={`${componentId}-amount-${index}`} className="text-sm font-medium">Annual amount {index + 1}</label><input id={`${componentId}-amount-${index}`} required inputMode="decimal" placeholder="e.g. 12000.00" value={component.amount} onChange={event => setComponents(current => current.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} className={inputClass} /></div></div>
    </div>)}
    <Button type="button" variant="outline" disabled={components.length >= 30} onClick={() => setComponents(current => [...current, { name: "", amount: "" }])}>+ Add fee component</Button>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4" aria-live="polite"><p className="text-sm text-indigo-900">Annual total per student</p><p className="mt-1 text-2xl font-semibold">{annualTotal === null ? "Enter the fee amounts" : `₹${displayMoney(annualTotal)}`}</p><p className="mt-2 text-xs text-slate-600">{({ MONTHLY: "12 monthly installments", QUARTERLY: "4 quarterly installments", ANNUAL: "1 annual installment" })[values.frequency as "MONTHLY" | "QUARTERLY" | "ANNUAL"]}. Payments may be collected in any amount.</p></div>
    <p className="text-xs leading-relaxed text-slate-500">Review the year, class and total before saving. This plan assigns fees to students already enrolled in this class and year. Assigned charges are preserved.</p>
  </>}</SchoolForm>;
}

export function PrintReceipt() { return <Button onClick={() => window.print()} className="print:hidden">Print receipt</Button>; }
