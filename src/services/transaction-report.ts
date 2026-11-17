import { reportCte, schoolToday } from "./fee-reports";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportFiltersSchema, studentSqlWhere } from "./report-filters";

export type TransactionRow = { eventId: string; recordId: string; studentId: string; eventOn: string; kind: string; name: string; admissionNumber: string; className: string; lifecycle: string; mode: string; amountPaise: number; cashPaise: number; discountPaise: number; state: string; receipt: string; reason: string; actor: string; recordedAt: Date };

export function transactionQuery(schoolId: string, input: unknown, page?: number) {
  const f = reportFiltersSchema.parse(input);
  const scope = studentSqlWhere(schoolId, f);
  return Prisma.sql`${reportCte(schoolId, schoolToday(), f)}, events AS (
    SELECT 'P-' || p.id AS "eventId", p.id AS "recordId", s.id AS "studentId", p."paidOn"::text AS "eventOn", 'PAYMENT' AS kind,
      p."studentName" AS name, p."studentAdmissionNumber" AS "admissionNumber", s."className", s.status::text AS lifecycle, p.mode::text,
      p."amountPaise", p."amountPaise" AS "cashPaise", 0 AS "discountPaise", CASE WHEN p."reversedAt" IS NULL THEN 'ACTIVE' ELSE 'REVERSED' END AS state,
      p."receiptNumber" AS receipt, COALESCE(p.reference, '') AS reason, p."recordedByName" AS actor, p."createdAt" AS "recordedAt"
    FROM "Payment" p JOIN student_profiles s ON s.id = p."studentId" AND s."schoolId" = p."schoolId" WHERE ${scope}
    UNION ALL
    SELECT 'PR-' || p.id, p.id, s.id, (p."reversedAt" AT TIME ZONE 'Asia/Kolkata')::date::text, 'PAYMENT_REVERSAL',
      p."studentName", p."studentAdmissionNumber", s."className", s.status::text, p.mode::text, p."amountPaise", -p."amountPaise", 0, 'REVERSED', p."receiptNumber", p."reversalReason", COALESCE(u.name, p."reversedById"), p."reversedAt"
    FROM "Payment" p JOIN student_profiles s ON s.id = p."studentId" AND s."schoolId" = p."schoolId" LEFT JOIN "User" u ON u.id = p."reversedById" WHERE ${scope} AND p."reversedAt" IS NOT NULL
    UNION ALL
    SELECT 'D-' || d.id, d.id, s.id, (d."createdAt" AT TIME ZONE 'Asia/Kolkata')::date::text, 'DISCOUNT',
      s.name, s."admissionNumber", s."className", s.status::text, '', d."amountPaise", 0, d."amountPaise", CASE WHEN d."reversedAt" IS NULL THEN 'ACTIVE' ELSE 'REVERSED' END, '', d.reason, d."recordedByName", d."createdAt"
    FROM "Discount" d JOIN student_profiles s ON s.id = d."studentId" AND s."schoolId" = d."schoolId" WHERE ${scope}
    UNION ALL
    SELECT 'DR-' || d.id, d.id, s.id, (d."reversedAt" AT TIME ZONE 'Asia/Kolkata')::date::text, 'DISCOUNT_REVERSAL',
      s.name, s."admissionNumber", s."className", s.status::text, '', d."amountPaise", 0, -d."amountPaise", 'REVERSED', '', d."reversalReason", COALESCE(u.name, d."reversedById"), d."reversedAt"
    FROM "Discount" d JOIN student_profiles s ON s.id = d."studentId" AND s."schoolId" = d."schoolId" LEFT JOIN "User" u ON u.id = d."reversedById" WHERE ${scope} AND d."reversedAt" IS NOT NULL
  ) SELECT * FROM events WHERE true
    ${f.from ? Prisma.sql`AND "eventOn" >= ${f.from}` : Prisma.empty}
    ${f.to ? Prisma.sql`AND "eventOn" <= ${f.to}` : Prisma.empty}
    ${f.mode !== "ALL" ? Prisma.sql`AND mode = ${f.mode}` : Prisma.empty}
    ORDER BY "eventOn" DESC, "recordedAt" DESC, "eventId" DESC
    ${page === undefined ? Prisma.empty : Prisma.sql`LIMIT 51 OFFSET ${(page - 1) * 50}`}`;
}

export async function transactionReport(schoolId: string, input: unknown, page?: number) {
  return prisma.$queryRaw<TransactionRow[]>(transactionQuery(schoolId, input, page));
}
