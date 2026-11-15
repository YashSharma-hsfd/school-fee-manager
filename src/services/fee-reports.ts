import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function schoolToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Aggregate allocations before joining charges; joining two allocation tables directly would multiply amounts.
export function reportCte(schoolId: string, today: string) {
  return Prisma.sql`WITH paid AS (
    SELECT a."chargeId", SUM(a."amountCents") AS amount FROM "PaymentAllocation" a
    JOIN "Payment" p ON p.id = a."paymentId" AND p."schoolId" = a."schoolId"
    WHERE a."schoolId" = ${schoolId} AND p."reversedAt" IS NULL GROUP BY a."chargeId"
  ), credited AS (
    SELECT "chargeId", SUM("amountCents") AS amount FROM "DiscountAllocation" WHERE "schoolId" = ${schoolId} GROUP BY "chargeId"
  ), charge_balances AS (
    SELECT e."studentId", c."amountCents" AS charged, c."dueOn",
      c."amountCents" - COALESCE(p.amount, 0) - COALESCE(d.amount, 0) AS remaining
    FROM "StudentCharge" c JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."schoolId" = c."schoolId"
    LEFT JOIN paid p ON p."chargeId" = c.id LEFT JOIN credited d ON d."chargeId" = c.id
    WHERE c."schoolId" = ${schoolId}
  ), student_balances AS (
    SELECT s.id, s.name, s."admissionNumber", s."className", COUNT(c."studentId") AS "chargeCount",
      COALESCE(SUM(c.charged), 0)::bigint AS charged,
      COALESCE(SUM(c.remaining), 0)::bigint AS remaining,
      COALESCE(SUM(CASE WHEN c."dueOn" < ${today}::date THEN c.remaining ELSE 0 END), 0)::bigint AS overdue
    FROM "Student" s LEFT JOIN charge_balances c ON c."studentId" = s.id
    WHERE s."schoolId" = ${schoolId} GROUP BY s.id
  )`;
}

export async function schoolReport(schoolId: string, page: number, status: string) {
  const today = schoolToday();
  const cte = reportCte(schoolId, today);
  const filter = status === "overdue" ? Prisma.sql`WHERE overdue > 0` : status === "paid" ? Prisma.sql`WHERE "chargeCount" > 0 AND remaining = 0` : status === "current" ? Prisma.sql`WHERE "chargeCount" > 0 AND overdue = 0` : Prisma.empty;
  const [summaryRows, students, collections, discounts] = await Promise.all([
    prisma.$queryRaw<{ students: bigint; assigned: bigint; overdueStudents: bigint; fullyPaid: bigint; upToDate: bigint; outstanding: bigint; overdue: bigint }[]>(Prisma.sql`${cte}
      SELECT COUNT(*)::bigint AS students, COUNT(*) FILTER (WHERE "chargeCount" > 0)::bigint AS assigned,
        COUNT(*) FILTER (WHERE overdue > 0)::bigint AS "overdueStudents",
        COUNT(*) FILTER (WHERE "chargeCount" > 0 AND remaining = 0)::bigint AS "fullyPaid",
        COUNT(*) FILTER (WHERE "chargeCount" > 0 AND overdue = 0)::bigint AS "upToDate",
        COALESCE(SUM(remaining), 0)::bigint AS outstanding, COALESCE(SUM(overdue), 0)::bigint AS overdue FROM student_balances`),
    prisma.$queryRaw<{ id: string; name: string; admissionNumber: string; className: string; chargeCount: bigint; remaining: bigint; overdue: bigint }[]>(Prisma.sql`${cte} SELECT * FROM student_balances ${filter} ORDER BY name, id LIMIT 51 OFFSET ${(page - 1) * 50}`),
    prisma.payment.aggregate({ where: { schoolId, reversedAt: null }, _sum: { amountCents: true }, _count: true }),
    prisma.discount.aggregate({ where: { schoolId }, _sum: { amountCents: true } }),
  ]);
  return { today, summary: summaryRows[0], students: students.slice(0, 50), hasNext: students.length > 50, collections, discounts };
}
