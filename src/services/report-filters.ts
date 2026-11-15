import { z } from "zod";
import { Prisma } from "@prisma/client";

export const studentSearchFields = {
  q: z.string().trim().max(120).default(""),
  className: z.string().trim().max(60).default(""),
  lifecycle: z.enum(["ALL", "ACTIVE", "INACTIVE", "WITHDRAWN"]).default("ALL"),
};
export const studentSearchSchema = z.object(studentSearchFields);
export const paymentModes = ["ALL", "CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"] as const;

export const reportFiltersSchema = z.object({
  ...studentSearchFields,
  mode: z.enum(paymentModes).default("ALL"),
  from: z.union([z.iso.date(), z.literal("")]).default(""),
  to: z.union([z.iso.date(), z.literal("")]).default(""),
}).refine(data => !data.from || !data.to || data.from <= data.to, "Start date must not follow end date");

export function studentWhere(input: unknown): Prisma.StudentWhereInput {
  const f = studentSearchSchema.parse(input);
  return {
    ...(f.className ? { className: f.className } : {}),
    ...(f.lifecycle !== "ALL" ? { status: f.lifecycle } : {}),
    ...(f.q ? { OR: ["name", "admissionNumber", "guardianName", "guardianPhone"].map(key => ({ [key]: { contains: f.q, mode: "insensitive" as const } })) } : {}),
  };
}

export function studentSqlWhere(schoolId: string, input: unknown) {
  const f = studentSearchSchema.parse(input);
  return Prisma.sql`s."schoolId" = ${schoolId}
    ${f.className ? Prisma.sql`AND s."className" = ${f.className}` : Prisma.empty}
    ${f.lifecycle !== "ALL" ? Prisma.sql`AND s.status = ${f.lifecycle}::"StudentStatus"` : Prisma.empty}
    ${f.q ? Prisma.sql`AND (strpos(lower(s.name), lower(${f.q})) > 0 OR strpos(lower(s."admissionNumber"), lower(${f.q})) > 0 OR strpos(lower(s."guardianName"), lower(${f.q})) > 0 OR strpos(lower(s."guardianPhone"), lower(${f.q})) > 0)` : Prisma.empty}`;
}

export function paymentWhere(schoolId: string, input: unknown): Prisma.PaymentWhereInput {
  const f = reportFiltersSchema.parse(input);
  const scoped = f.q || f.className || f.lifecycle !== "ALL";
  return { schoolId, reversedAt: null,
    ...(scoped ? { student: { schoolId, ...studentWhere(f) } } : {}),
    ...(f.mode !== "ALL" ? { mode: f.mode } : {}),
    paidOn: { ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}), ...(f.to ? { lte: new Date(`${f.to}T00:00:00Z`) } : {}) },
  };
}

export const balanceStatusSchema = z.enum(["all", "overdue", "paid", "current", "unassigned", "outstanding"]);
export function balanceSqlFilter(status: string) {
  balanceStatusSchema.parse(status);
  return status === "overdue" ? Prisma.sql`WHERE overdue > 0` : status === "paid" ? Prisma.sql`WHERE "chargeCount" > 0 AND remaining = 0`
    : status === "current" ? Prisma.sql`WHERE "chargeCount" > 0 AND overdue = 0` : status === "unassigned" ? Prisma.sql`WHERE "chargeCount" = 0`
    : status === "outstanding" ? Prisma.sql`WHERE remaining > 0` : Prisma.empty;
}

export function csv(rows: (string | number | bigint)[][]) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    const text = String(value);
    // Prevent spreadsheet formula execution in names, references and other user input.
    const safe = /^[\s]*[=+@-]/.test(text) && !/^-\d+(\.\d+)?$/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}

export function decimalMoney(value: number | bigint) {
  const cents = BigInt(value), absolute = cents < BigInt(0) ? -cents : cents;
  return `${cents < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
