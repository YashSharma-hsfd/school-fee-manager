import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { PrintReceipt, SchoolForm } from "@/components/school-forms";
import { reverse } from "@/actions/schools";
import { dateOnly, displayMoney } from "@/services/fee-calculations";

export default async function ReceiptPage({ params }: { params: Promise<{ schoolId: string; paymentId: string }> }) {
  const { schoolId, paymentId } = await params;
  const { membership } = await schoolAccess(schoolId);
  const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId }, include: { student: true, allocations: { include: { charge: { include: { enrollment: { include: { academicYear: true, schoolClass: true } } } } } } } });
  if (!payment) notFound();
  return <main id="main-content" className="mx-auto max-w-3xl px-6 py-10">
    <article className="rounded-xl border bg-white p-8 print:border-0"><header className="border-b pb-6"><p className="text-xl font-semibold">{payment.schoolName}</p><h1 className="mt-3 text-3xl font-semibold">Fee payment receipt</h1><p className="mt-2">Receipt: {payment.receiptNumber}</p>{payment.reversedAt && <p className="mt-3 font-bold text-red-700">REVERSED — {payment.reversalReason}</p>}</header>
      <dl className="my-6 grid grid-cols-2 gap-4 text-sm">{[["Student", payment.studentName], ["Admission number", payment.studentAdmissionNumber], ["Payment date", dateOnly(payment.paidOn)], ["Payment mode", payment.mode.replaceAll("_", " ")], ["Transaction reference", payment.reference || "—"], ["Recorded by", payment.recordedByName], ["Recorded at (UTC)", payment.createdAt.toISOString()]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
      <table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Fee / academic year</th><th className="py-3 text-right">Amount received</th></tr></thead><tbody>{payment.allocations.map(item => <tr key={item.id} className="border-b"><td className="py-3">{item.charge.label} · {(item.charge.enrollment?.academicYear.name || "Opening balance")} · {(item.charge.enrollment?.schoolClass.name || "")}<span className="block text-xs text-slate-500">Due {dateOnly(item.charge.dueOn)}</span></td><td className="py-3 text-right">{displayMoney(item.amountPaise)}</td></tr>)}</tbody></table>
      <p className="mt-6 text-right text-xl font-semibold">Total received: {displayMoney(payment.amountPaise)}</p>
    </article>
    <div className="my-6 flex flex-wrap items-center justify-between gap-4 print:hidden"><Link className="text-indigo-700" href={`/schools/${schoolId}/students/${payment.studentId}`}>Back to student account</Link><div className="flex flex-wrap gap-3"><PrintReceipt /><Button asChild variant="outline"><Link href={`/schools/${schoolId}/students`}>{membership.role === "ACCOUNTANT" ? "Collect next payment" : "Find another student"}</Link></Button></div></div><p className="text-sm text-slate-500 print:hidden">To save a PDF, choose Save as PDF in the print dialog. Reprinting keeps this receipt number.</p>
    {membership.role === "ACCOUNTANT" && !payment.reversedAt && <details className="mt-8 rounded-xl border border-red-200 bg-white p-6 print:hidden"><summary className="font-semibold text-red-700">Correct an incorrectly recorded payment</summary><div className="mt-4"><p className="mb-4 text-sm text-slate-500">Reverse this payment before entering a corrected one. The original receipt stays in history and its allocations stop reducing dues.</p><SchoolForm action={reverse.bind(null, schoolId, paymentId)} variant="danger" submit="Reverse payment" fields={[{ name: "reason", label: "Reason for reversal", help: "The receipt is kept in history and its amount becomes due again. This is a recording correction, not a refund." }]} /></div></details>}
  </main>;
}
