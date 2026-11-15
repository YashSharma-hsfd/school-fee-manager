"use client";
import { useState, useTransition } from "react";
import { previewStudentImport, confirmStudentImport } from "@/actions/operations";

export function StudentImport({ schoolId }: { schoolId: string }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ admissionNumber: string; name: string; className: string; guardianName: string; guardianPhone: string; openingDue: string; dueOn: string }[]>([]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return <section className="space-y-4 rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Import students and opening dues</h2><p className="text-sm text-slate-600">Save the template from Excel as CSV UTF-8. Maximum 500 students, 512 KB. Import creates new students only. It does not assign new-year fees; enroll students afterward. Opening dues must contain only unpaid balances carried forward.</p><a className="text-indigo-700" href={`/schools/${schoolId}/operations/template`}>Download CSV template</a><label className="block">Student CSV<input type="file" accept=".csv,text/csv" disabled={pending} className="mt-2 block" onChange={async event => {
    setPreview([]); setText(""); setMessage("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 512_000) { setMessage("File must be under 512 KB"); return; }
    try { setText(await file.text()); }
    catch { setMessage("Could not read this file. Select a CSV UTF-8 file and try again."); }
  }} /></label><button disabled={!text || pending} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" onClick={() => start(async () => {
    const result = await previewStudentImport(schoolId, text);
    setPreview(result.rows); setMessage(result.error);
  })}>Preview import</button>{preview.length > 0 && <><p>{preview.length} students ready. No records have been written.</p><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Admission</th><th>Name</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Opening dues</th><th>Due date</th></tr></thead><tbody>{preview.map(row => <tr key={row.admissionNumber}><td className="p-2">{row.admissionNumber}</td><td className="p-2">{row.name}</td><td className="p-2">{row.className}</td><td className="p-2">{row.guardianName}</td><td className="p-2">{row.guardianPhone}</td><td className="p-2">{row.openingDue || "0"}</td><td className="p-2">{row.dueOn || "—"}</td></tr>)}</tbody></table></div><button disabled={pending} className="rounded bg-indigo-700 px-4 py-2 text-white" onClick={() => start(async () => {
    const result = await confirmStudentImport(schoolId, text); setMessage(result.error || result.success);
    if (!result.error) { setPreview([]); setText(""); }
  })}>Confirm import of {preview.length} students</button></>}{message && <p role="status">{message}</p>}</section>;
}
