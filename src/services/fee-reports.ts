import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportFiltersSchema, paymentWhere, studentSqlWhere, balanceSqlFilter, studentWhere } from "./report-filters";

export async function collectionReport(schoolId: string, input: unknown) {
  const filters = reportFiltersSchema.parse(input);
  const where = paymentWhere(schoolId, filters);
  const modes = await prisma.payment.groupBy({ by: ["mode"], where, _sum: { amountCents: true }, _count: true, orderBy: { mode: "asc" } });
  return { filters, modes, total: modes.reduce((sum, mode) => sum + BigInt(mode._sum.amountCents || 0), BigInt(0)) };
}

export function schoolToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Aggregate allocations before joining charges; joining two allocation tables directly would multiply amounts.
export function reportCte(schoolId: string, today: string, input: unknown = {}) {
  return Prisma.sql`WITH paid AS (
    SELECT a."chargeId", SUM(a."amountCents") AS amount FROM "PaymentAllocation" a
    JOIN "Payment" p ON p.id = a."paymentId" AND p."schoolId" = a."schoolId"
    WHERE a."schoolId" = ${schoolId} AND p."reversedAt" IS NULL GROUP BY a."chargeId"
  ), credited AS (
    SELECT a."chargeId", SUM(a."amountCents") AS amount FROM "DiscountAllocation" a
    JOIN "Discount" d ON d.id = a."discountId" AND d."schoolId" = a."schoolId"
    WHERE a."schoolId" = ${schoolId} AND d."reversedAt" IS NULL GROUP BY a."chargeId"
  ), charge_balances AS (
    SELECT COALESCE(e."studentId", c."openingStudentId") AS "studentId", c."amountCents" AS charged, c."dueOn",
      c."amountCents" - COALESCE(p.amount, 0) - COALESCE(d.amount, 0) AS remaining
    FROM "StudentCharge" c LEFT JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."schoolId" = c."schoolId"
    LEFT JOIN paid p ON p."chargeId" = c.id LEFT JOIN credited d ON d."chargeId" = c.id
    WHERE c."schoolId" = ${schoolId}
  ), student_balances AS (
    SELECT s.id, s.name, s."admissionNumber", s."className", s.status, COUNT(c."studentId") AS "chargeCount",
      COALESCE(SUM(c.charged), 0)::bigint AS charged,
      COALESCE(SUM(c.remaining), 0)::bigint AS remaining,
      COALESCE(SUM(CASE WHEN c."dueOn" < ${today}::date THEN c.remaining ELSE 0 END), 0)::bigint AS overdue
    FROM "Student" s LEFT JOIN charge_balances c ON c."studentId" = s.id
    WHERE ${studentSqlWhere(schoolId, input)} GROUP BY s.id
  )`;
}

export async function schoolReport(schoolId: string, page: number, status: string, input: unknown = {}) {
  const today = schoolToday();
  const cte = reportCte(schoolId, today, input);
  const filter = balanceSqlFilter(status);
  const [summaryRows, students, collections, discounts] = await Promise.all([
    prisma.$queryRaw<{ students: bigint; assigned: bigint; overdueStudents: bigint; fullyPaid: bigint; upToDate: bigint; outstanding: bigint; overdue: bigint }[]>(Prisma.sql`${cte}
      SELECT COUNT(*)::bigint AS students, COUNT(*) FILTER (WHERE "chargeCount" > 0)::bigint AS assigned,
        COUNT(*) FILTER (WHERE overdue > 0)::bigint AS "overdueStudents",
        COUNT(*) FILTER (WHERE "chargeCount" > 0 AND remaining = 0)::bigint AS "fullyPaid",
        COUNT(*) FILTER (WHERE "chargeCount" > 0 AND overdue = 0)::bigint AS "upToDate",
        COALESCE(SUM(remaining), 0)::bigint AS outstanding, COALESCE(SUM(overdue), 0)::bigint AS overdue FROM student_balances ${filter}`),
    prisma.$queryRaw<{ id: string; name: string; admissionNumber: string; className: string; status: "ACTIVE" | "INACTIVE" | "WITHDRAWN"; chargeCount: bigint; remaining: bigint; overdue: bigint }[]>(Prisma.sql`${cte} SELECT * FROM student_balances ${filter} ORDER BY name, id LIMIT 51 OFFSET ${(page - 1) * 50}`),
    prisma.payment.aggregate({ where: { schoolId, reversedAt: null, student: { schoolId, ...studentWhere(input) } }, _sum: { amountCents: true }, _count: true }),
    prisma.discount.aggregate({ where: { schoolId, reversedAt: null, student: { schoolId, ...studentWhere(input) } }, _sum: { amountCents: true } }),
  ]);
  return { today, summary: summaryRows[0], students: students.slice(0, 50), hasNext: students.length > 50, collections, discounts };
}
