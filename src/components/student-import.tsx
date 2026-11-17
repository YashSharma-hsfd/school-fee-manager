"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { previewStudentImport, confirmStudentImport } from "@/actions/operations";
import { displayMoney, moneySchema } from "@/services/fee-calculations";
import { FormFeedback } from "./form-feedback";
import { Button } from "./ui/button";

export function StudentImport({ schoolId }: { schoolId: string }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewStudentImport>>["rows"]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const openingTotal = preview.reduce((sum, row) => { const amount = moneySchema.safeParse(row.openingDue); return sum + (amount.success ? amount.data : 0); }, 0);
  return <section aria-busy={pending} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <header><h2 className="text-xl font-semibold">Import students and opening dues</h2><p className="mt-2 text-sm text-slate-500">Bring in up to 500 new students at once. Review the preview before anything is saved.</p></header>
    <ol aria-label="Import steps" className="grid gap-3 sm:grid-cols-3">{["Download the template", "Choose your CSV", "Review and import"].map((label, i) => <li key={label} className={`rounded-xl border p-3 text-sm ${i === (preview.length ? 2 : text ? 1 : 0) ? "border-indigo-200 bg-indigo-50 text-indigo-900" : "border-slate-200 text-slate-500"}`}><span className="mr-2 font-semibold">{i + 1}.</span>{label}</li>)}</ol>
    <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">Start with the correct columns</h3><p className="mb-3 mt-2 text-xs leading-relaxed text-slate-500">Save the completed template as CSV UTF-8. DOB is required. Admission date and guardian details may be blank.</p><Button asChild variant="outline"><a href={`/schools/${schoolId}/operations/template`}>Download CSV template</a></Button></div>
      <div className="rounded-xl border border-dashed border-slate-300 p-4"><label className="block text-sm font-semibold">Student CSV<input ref={fileInput} type="file" accept=".csv,text/csv" disabled={pending} className="mt-3 block w-full text-sm" onChange={async event => {
        setPreview([]); setText(""); setError(""); setSuccess(""); setFileName("");
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 512_000) { setError("File must be under 512 KB. Split a larger import into smaller batches."); return; }
        try { setText(await file.text()); setFileName(file.name); }
        catch { setError("Could not read this file. Select a CSV UTF-8 file and try again."); }
      }} /></label><p className="mt-3 text-xs text-slate-500">Maximum 512 KB · 500 students · New records only</p></div></div>
    <details className="rounded-xl border border-slate-200 p-4 text-sm"><summary>How enrollment and opening dues work</summary><ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-slate-600"><li>Leave academicYear and className empty to enroll later, or provide both using names already configured for this school.</li><li>Providing a class and year enrolls the student and assigns the full annual fees, including mid-year admissions. Use discounts for concessions. Optional sectionName, rollNumber and enrollmentDate must match that placement; leave them blank when unknown. Missing fee plans are flagged.</li><li>Opening dues contain only unpaid amounts carried forward. Use rupees and a due date. Do not include fees you will assign again through a plan.</li><li>Dates use YYYY-MM-DD. One invalid or duplicate admission number stops the whole batch; no partial import is saved.</li></ul></details>
    {!!text && <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} onClick={() => start(async () => {
      setError(""); setSuccess("");
      try { const result = await previewStudentImport(schoolId, text); setPreview(result.rows); setError(result.error); }
      catch { setError("The preview could not load. Check your connection and try again."); }
    })}>{pending ? "Checking file…" : "Preview import"}</Button><span className="text-sm text-slate-500">{fileName}</span></div>}
    {preview.length > 0 && <div className="space-y-4 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Review the import</h3><p className="mt-1 text-sm text-slate-500">{preview.length} students ready. No records have been written.</p></div><p className="rounded-lg bg-slate-50 px-4 py-3 text-sm">Total opening dues <strong className="ml-2 tabular-nums">₹{displayMoney(openingTotal)}</strong></p></div>
      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[840px] text-left text-sm"><caption className="sr-only">Students and opening dues to import</caption><thead className="sticky top-0 border-b bg-slate-50"><tr>{["Admission", "Student", "Date of birth", "Year / class", "Primary contact", "Opening dues", "Due date"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{preview.map(row => <tr key={row.admissionNumber} className="border-b border-slate-100"><td className="p-3 font-mono text-xs">{row.admissionNumber}</td><td className="p-3 font-medium">{row.name}</td><td className="p-3">{row.dateOfBirth}</td><td className="p-3">{row.academicYear ? `${row.academicYear} / ${row.className}${row.sectionName ? ` / ${row.sectionName}` : ""}${row.rollNumber ? ` / Roll ${row.rollNumber}` : ""}${row.enrollmentDate ? ` / From ${row.enrollmentDate}` : ""}` : "Enroll later"}</td><td className="p-3">{row.guardianName || "Not provided"}<p className="mt-1 text-xs text-slate-500">{row.guardianPhone}</p></td><td className="p-3 tabular-nums">₹{row.openingDue || "0.00"}</td><td className="p-3">{row.dueOn || "—"}</td></tr>)}</tbody></table></div>
      <Button disabled={pending} onClick={() => start(async () => {
        setError("");
        try { const result = await confirmStudentImport(schoolId, text); setError(result.error); setSuccess(result.success ?? ""); if (!result.error) { setPreview([]); setText(""); setFileName(""); if (fileInput.current) fileInput.current.value = ""; } }
        catch { setError("The result could not be confirmed. Check the student directory before retrying this import."); }
      })}>{pending ? "Importing…" : `Confirm import of ${preview.length} students`}</Button>
    </div>}
    <FormFeedback error={error} success={success}><Button asChild variant="outline"><Link href={`/schools/${schoolId}/students`}>View student accounts →</Link></Button></FormFeedback>
  </section>;
}
