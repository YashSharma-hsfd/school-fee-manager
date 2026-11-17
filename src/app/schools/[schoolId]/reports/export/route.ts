import { z } from "zod";
import { Prisma } from "@prisma/client";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { reportCte, schoolToday } from "@/services/fee-reports";
import { csv, decimalMoney, reportFiltersSchema, paymentWhere, balanceStatusSchema, balanceSqlFilter } from "@/services/report-filters";
import { transactionReport } from "@/services/transaction-report";

export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  await schoolAccess(schoolId);
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = reportFiltersSchema.safeParse(query);
  const kind = z.enum(["collections", "overdue", "balances", "transactions"]).safeParse(query.kind);
  const status = balanceStatusSchema.default("all").safeParse(query.status);
  if (!parsed.success || !kind.success || !status.success) return new Response("Invalid report filters", { status: 400 });
  let rows: (string | number | bigint)[][];
  if (kind.data === "collections") {
    const payments = await prisma.payment.findMany({ where: paymentWhere(schoolId, parsed.data), orderBy: [{ paidOn: "asc" }, { id: "asc" }] });
    rows = [["Receipt", "Date", "Admission number", "Student", "Mode", "Reference", "Amount", "Recorded by"], ...payments.map(p => [p.receiptNumber, p.paidOn.toISOString().slice(0, 10), p.studentAdmissionNumber, p.studentName, p.mode, p.reference || "", decimalMoney(p.amountPaise), p.recordedByName])];
  } else if (kind.data === "transactions") {
    const events = await transactionReport(schoolId, parsed.data);
    rows = [["Event date", "Event type", "Record ID", "Admission number", "Student", "Class (current)", "Student status (current)", "Mode", "Amount", "Cash collected change", "Discount change", "Record state (current)", "Receipt", "Reference / reason", "Actor name or ID", "Recorded at (UTC)"], ...events.map(e => [e.eventOn, e.kind, e.recordId, e.admissionNumber, e.name, e.className, e.lifecycle, e.mode, decimalMoney(e.amountPaise), decimalMoney(e.cashPaise), decimalMoney(e.discountPaise), e.state, e.receipt, e.reason, e.actor, e.recordedAt.toISOString()])];
  } else {
    const filter = balanceSqlFilter(kind.data === "overdue" ? "overdue" : status.data);
    const students = await prisma.$queryRaw<{ name: string; admissionNumber: string; className: string; remaining: bigint; overdue: bigint }[]>(Prisma.sql`${reportCte(schoolId, schoolToday(), parsed.data)} SELECT * FROM student_balances ${filter} ORDER BY name, id`);
    rows = [["Admission number", "Student", "Class", "Outstanding", "Overdue"], ...students.map(s => [s.admissionNumber, s.name, s.className, decimalMoney(s.remaining), decimalMoney(s.overdue)])];
  }
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind.data}.csv"`, "Cache-Control": "private, no-store" } });
}
