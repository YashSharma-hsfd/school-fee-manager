import Link from "next/link";
import { Button } from "@/components/ui/button";
import { saveStudentStatus } from "@/actions/operations";
import { statusLabels } from "@/services/student-status";
import { correctStudentCharge, reverseStudentDiscount } from "@/actions/operations";
import { decimalMoney } from "@/services/report-filters";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { SchoolForm } from "@/components/school-forms";
import { enroll, pay, discount } from "@/actions/schools";
import { balances, dateOnly, displayMoney } from "@/services/fee-calculations";
import { schoolToday } from "@/services/fee-reports";
import { openCharges } from "@/services/fees";

export default async function StudentAccountPage({ params }: { params: Promise<{ schoolId: string; studentId: string }> }) {
  const { schoolId, studentId } = await params;
  const { membership } = await schoolAccess(schoolId);
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
  if (!student) notFound();
  const [charges, years, classes, enrollments, payments, discounts] = await Promise.all([
    openCharges(prisma, schoolId, studentId),
    membership.role === "ADMIN" ? prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startsOn: "desc" } }) : [],
    membership.role === "ADMIN" ? prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }) : [],
    prisma.enrollment.findMany({ where: { schoolId, studentId }, include: { academicYear: true, schoolClass: true }, orderBy: { academicYear: { startsOn: "desc" } } }),
    prisma.payment.findMany({ where: { schoolId, studentId }, orderBy: { createdAt: "desc" } }),
    prisma.discount.findMany({ where: { schoolId, studentId }, orderBy: { createdAt: "desc" } }),
  ]);
  const summary = balances(charges, new Date(`${schoolToday()}T00:00:00.000Z`));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const yearNames = new Map(enrollments.map(record => [record.id, `${record.academicYear.name} · ${record.schoolClass.name}`]));
  return <main className="mx-auto max-w-6xl px-6 py-10">
    <Link href={`/schools/${schoolId}/students`} className="mb-5 inline-block text-sm font-semibold text-indigo-700">Back to student accounts</Link>
    <h1 className="text-3xl font-semibold">{student.name}</h1><p className="mt-2 text-slate-500">{student.admissionNumber} · Current class: {student.className}</p>
    <dl className="mt-4 grid max-w-2xl gap-3 rounded-xl border bg-white p-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Guardian</dt><dd className="mt-1 font-medium">{student.guardianName}</dd></div><div><dt className="text-slate-500">Guardian phone</dt><dd className="mt-1 font-medium">{student.guardianPhone}</dd></div></dl>
    <p className="mt-3 font-medium">Student status: {statusLabels[student.status]}</p>{student.statusChangedAt && <p className="mt-1 text-sm text-slate-500">Changed {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(student.statusChangedAt)} (Asia/Kolkata): {student.statusReason}</p>}
    <nav aria-label="Account tasks" className="my-5 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
      {membership.role === "ACCOUNTANT" && summary.outstanding > 0 && <Button asChild><a href="#record-payment">Collect payment</a></Button>}
      {membership.role === "ADMIN" && student.status === "ACTIVE" && <Button asChild><a href="#enrollment">Enroll / promote</a></Button>}
      <Link href="#charges" className="text-sm font-medium text-indigo-700">View charges</Link><Link href="#payment-history" className="text-sm font-medium text-indigo-700">Payment history & receipts</Link><Link href="#academic-history" className="text-sm font-medium text-indigo-700">Academic history</Link>
    </nav>
    {membership.role === "ACCOUNTANT" && summary.outstanding === 0 && <p className="mb-5 rounded-xl border bg-white p-4 text-sm">{charges.length ? "This account is fully paid. Existing receipts remain available in Payment history." : "No fees have been assigned. Ask administration to enroll this student before recording a payment."}</p>}
    {student.status !== "ACTIVE" && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm">Enrollment and promotion are paused. Existing charges, including future installments, remain payable. Accountants can continue collecting dues and reprinting receipts.</p>}
    {membership.role === "ADMIN" && <details className="my-5 max-w-xl rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">Change student status</summary><p className="my-4 text-sm text-slate-500">Inactive is a temporary pause; withdrawn means the student has left. Neither cancels fees or prorates installments. Reactivation restores enrollment eligibility. Every change requires a reason and is audited.</p><SchoolForm action={saveStudentStatus.bind(null, schoolId, studentId)} submit="Save student status" fields={[
      { name: "status", label: "New student status", value: student.status, options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
      { name: "reason", label: "Reason for status change" }, { name: "expectedUpdatedAt", label: "", type: "hidden", value: student.updatedAt.toISOString() },
    ]} /></details>}
    <section className="my-7 grid gap-4 sm:grid-cols-3">{[["Total outstanding (all years)", summary.outstanding], ["Overdue", summary.overdue], ["Current and future dues", summary.futureAndCurrent]].map(([label, amount]) => <article key={label} className="rounded-xl border bg-white p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-2 text-2xl font-semibold">{displayMoney(amount as number)}</p></article>)}</section>
    {membership.role === "ADMIN" && student.status === "ACTIVE" && <section id="enrollment" className="mb-7 max-w-xl rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Enroll / promote manually</h2><p className="mb-4 text-sm text-slate-500">Creates this student&apos;s academic-year record and assigns the selected class&apos;s fees automatically. Earlier records and unpaid fees remain.</p>{years.length && classes.length ? <SchoolForm action={enroll.bind(null, schoolId, studentId)} submit="Save academic-year record" fields={[{ name: "academicYearId", label: "Academic year", options: years.map(year => ({ value: year.id, label: year.name })) }, { name: "classId", label: "Class", options: classes.map(item => ({ value: item.id, label: item.name })), value: classes.find(item => item.name === student.className)?.id }]} /> : <p>Ask a fee configurator to create classes, academic years and fee plans first.</p>}</section>}
    {membership.role === "ACCOUNTANT" && summary.outstanding > 0 && <div className="mb-7 grid items-start gap-6 md:grid-cols-2">
      <section id="record-payment" className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm"><h2 className="mb-3 text-lg font-semibold">Record payment</h2><p className="mb-4 text-sm text-slate-500">Enter any amount up to the outstanding balance. Oldest unpaid charges are settled first, including previous-year dues.</p><SchoolForm action={pay.bind(null, schoolId, studentId)} submit="Record payment & issue receipt" fields={[
        { name: "amount", label: "Amount paid", help: "Use up to two decimal places." }, { name: "paidOn", label: "Payment date", type: "date", value: today, max: today },
        { name: "mode", label: "Payment mode", options: ["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"].map(mode => ({ value: mode, label: mode.replaceAll("_", " ") })) },
        { name: "reference", label: "Transaction identifier / reference", required: false }, { name: "requestKey", label: "", type: "hidden", value: randomUUID() },
      ]} /></section>
      <section className="rounded-xl border bg-white p-6"><h2 className="mb-3 text-lg font-semibold">Apply discount</h2><p className="mb-4 text-sm text-slate-500">No approval is required. The amount, reason and your identity are retained in the audit trail. Discounts reduce oldest unpaid charges first.</p><SchoolForm action={discount.bind(null, schoolId, studentId)} submit="Apply discount" fields={[{ name: "amount", label: "Discount amount" }, { name: "reason", label: "Reason" }, { name: "requestKey", label: "", type: "hidden", value: randomUUID() }]} /></section>
    </div>}
    <section id="academic-history" className="mb-8"><h2 className="mb-4 text-xl font-semibold">Academic history</h2><div className="flex flex-wrap gap-3">{enrollments.map(record => <p key={record.id} className="rounded-lg border bg-white px-4 py-3 text-sm">{record.academicYear.name} · {record.schoolClass.name}</p>)}{!enrollments.length && <p className="text-slate-500">No academic-year record yet. Fees have not been assigned.</p>}</div></section>
    <section id="charges" className="mb-8"><h2 className="mb-4 text-xl font-semibold">Charges and due dates</h2><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Academic year / class", "Fee", "Due date", "Charged", "Settled / discounted", "Remaining"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{charges.map(charge => <tr key={charge.id} className="border-t"><td className="p-3">{(charge.enrollmentId ? yearNames.get(charge.enrollmentId) : "Opening balance")}</td><td className="p-3">{charge.label}</td><td className="p-3">{dateOnly(charge.dueOn)}</td><td className="p-3">{displayMoney(charge.amountCents)}</td><td className="p-3">{displayMoney(charge.settledCents)}</td><td className="p-3">{displayMoney(charge.amountCents - charge.settledCents)}{membership.configureFees && <details className="mt-2"><summary className="cursor-pointer text-indigo-700">Correct charge</summary><SchoolForm action={correctStudentCharge.bind(null, schoolId, charge.id)} submit="Save correction" fields={[
      { name: "amount", label: "Corrected charge amount", value: decimalMoney(charge.amountCents) },
      { name: "dueOn", label: "Corrected due date", type: "date", value: dateOnly(charge.dueOn) },
      { name: "expectedAmount", label: "", type: "hidden", value: String(charge.amountCents) },
      { name: "expectedDueOn", label: "", type: "hidden", value: dateOnly(charge.dueOn) },
      { name: "reason", label: "Reason for correction" },
    ]} /></details>}</td></tr>)}</tbody></table></div></section>
    <section id="payment-history" className="mb-8"><h2 className="mb-4 text-xl font-semibold">Payment history & receipts</h2>{!payments.length && <p className="mb-4 text-sm text-slate-500">No payments recorded yet. Receipts appear here after a payment is saved.</p>}<ul className="space-y-3">{payments.map(payment => <li key={payment.id} className="flex flex-wrap justify-between gap-3 rounded-lg border bg-white p-4 text-sm"><span>{dateOnly(payment.paidOn)} · {payment.mode.replaceAll("_", " ")} · {displayMoney(payment.amountCents)}{payment.reversedAt ? " · REVERSED" : ""}</span><Link className="text-indigo-700" href={`/schools/${schoolId}/receipts/${payment.id}`}>{payment.receiptNumber}</Link></li>)}</ul></section>
    <section><h2 className="mb-4 text-xl font-semibold">Discount history</h2><ul className="space-y-3">{discounts.map(item => <li key={item.id} className="rounded-lg border bg-white p-4 text-sm">{dateOnly(item.createdAt)} · {displayMoney(item.amountCents)} · {item.reason} · recorded by {item.recordedByName}{item.reversedAt ? <p className="mt-2 text-red-700">REVERSED: {item.reversalReason}</p> : membership.role === "ACCOUNTANT" && <details className="mt-3"><summary className="cursor-pointer text-indigo-700">Reverse discount</summary><SchoolForm action={reverseStudentDiscount.bind(null, schoolId, item.id)} submit="Reverse discount" fields={[{ name: "reason", label: "Reason for discount reversal" }]} /></details>}</li>)}</ul></section>
  </main>;
}
