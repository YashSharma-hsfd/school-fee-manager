import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { collectionReport, reportCte, schoolToday } from "./fee-reports";

export async function schoolDashboard(schoolId: string) {
  const today = schoolToday(), monthStart = `${today.slice(0, 7)}-01`;
  const [summaryRows, daily, monthly, recent] = await Promise.all([
    prisma.$queryRaw<{ active: bigint; inactive: bigint; withdrawn: bigint; unassigned: bigint; overdueStudents: bigint; overdue: bigint; outstanding: bigint }[]>(Prisma.sql`${reportCte(schoolId, today)}
      SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE')::bigint AS active,
        COUNT(*) FILTER (WHERE status = 'INACTIVE')::bigint AS inactive,
        COUNT(*) FILTER (WHERE status = 'WITHDRAWN')::bigint AS withdrawn,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND "feesNotConfigured")::bigint AS unassigned,
        COUNT(*) FILTER (WHERE overdue > 0)::bigint AS "overdueStudents",
        COALESCE(SUM(overdue), 0)::bigint AS overdue, COALESCE(SUM(remaining), 0)::bigint AS outstanding
      FROM student_balances`),
    collectionReport(schoolId, { from: today, to: today }),
    collectionReport(schoolId, { from: monthStart, to: today }),
    prisma.payment.findMany({ where: { schoolId, reversedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5,
      select: { id: true, studentId: true, receiptNumber: true, studentName: true, amountPaise: true, paidOn: true, mode: true } }),
  ]);
  return { today, monthStart, summary: summaryRows[0], daily, monthly, recent };
}
