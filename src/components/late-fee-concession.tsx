import { randomUUID } from "node:crypto";
import { waiveStudentLateFees } from "@/actions/late-fees";
import { SchoolForm } from "./school-forms";

export function LateFeeConcession({ schoolId, studentId, outstandingPaise }: { schoolId: string; studentId: string; outstandingPaise: number }) {
  if (outstandingPaise <= 0) return null;
  return <section id="late-fee-concession" className="mb-7 max-w-xl rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Waive late fees</h2><p className="mb-4 text-sm text-slate-500">Apply a concession to late fees only. Tuition and other principal charges remain unchanged. The reason and your identity are retained in discount history.</p>
    <SchoolForm action={waiveStudentLateFees.bind(null, schoolId, studentId)} variant="outline" submit="Waive late fees" financialSummary={{ outstandingPaise, kind: "discount" }} fields={[
      { name: "amount", label: "Late fees to waive", help: "Rupees. This can cover only currently outstanding late fees." },
      { name: "reason", label: "Reason for late-fee concession" },
      { name: "requestKey", label: "", type: "hidden", value: randomUUID() },
    ]} />
  </section>;
}
