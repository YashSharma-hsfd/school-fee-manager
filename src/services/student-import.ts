import { z } from "zod";
import { studentSchema } from "@/validators/student";
import { dateSchema, FeeRuleError, moneySchema } from "./fee-calculations";
import { inSchool } from "./fees";
import type { SessionUser } from "./auth";

export const importHeaders = ["admissionNumber", "name", "className", "guardianName", "guardianPhone", "openingDue", "dueOn"];

// RFC 4180 parsing, including quoted commas, escaped quotes and embedded newlines.
export function parseCsv(text: string): string[][] {
  if (text.length > 512_000) throw new FeeRuleError("Import must be under 512 KB");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; closed = false; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = ""; closed = false;
    } else {
      if (closed || ch === '"') throw new FeeRuleError("Malformed CSV quoting");
      cell += ch;
    }
  }
  if (quoted) throw new FeeRuleError("Unclosed CSV quote");
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  if (rows.length > 501) throw new FeeRuleError("Import at most 500 students at a time");
  return rows;
}

const rowSchema = studentSchema.extend({
  openingDue: z.string().trim().default(""), dueOn: z.string().trim().default(""),
}).transform((row, ctx) => {
  const amount = !row.openingDue || /^(0|0\.0{1,2})$/.test(row.openingDue) ? 0 : moneySchema.safeParse(row.openingDue);
  if (amount !== 0 && !amount.success) { ctx.addIssue({ code: "custom", message: "Invalid opening due" }); return z.NEVER; }
  const openingCents = amount === 0 ? 0 : amount.data;
  const due = row.dueOn ? dateSchema.safeParse(row.dueOn) : null;
  if ((openingCents > 0 && !due) || (due && !due.success)) { ctx.addIssue({ code: "custom", message: "Opening dues require a valid due date" }); return z.NEVER; }
  return { ...row, openingCents, openingDate: due?.success ? due.data : null };
});

export function validateImport(text: string) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers || headers.join(",") !== importHeaders.join(",")) throw new FeeRuleError(`Use these exact columns: ${importHeaders.join(",")}`);
  if (!rows.length) throw new FeeRuleError("Add at least one student");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new FeeRuleError(`Row ${index + 2}: expected ${headers.length} columns`);
    const parsed = rowSchema.safeParse(Object.fromEntries(headers.map((name, i) => [name, row[i]])));
    if (!parsed.success) throw new FeeRuleError(`Row ${index + 2}: ${parsed.error.issues.map(issue => issue.message).join("; ")}`);
    if (seen.has(parsed.data.admissionNumber)) throw new FeeRuleError(`Row ${index + 2}: duplicate admission number`);
    seen.add(parsed.data.admissionNumber);
    return parsed.data;
  });
}

export async function importStudents(actor: SessionUser, schoolId: string, text: string) {
  const rows = validateImport(text);
  return inSchool(actor, schoolId, "students", async tx => {
    const existing = await tx.student.findFirst({ where: { schoolId, admissionNumber: { in: rows.map(row => row.admissionNumber) } } });
    if (existing) throw new FeeRuleError(`Admission number ${existing.admissionNumber} already exists. No students imported.`);
    const students = await tx.student.createManyAndReturn({
      data: rows.map(({ admissionNumber, name, className, guardianName, guardianPhone }) => ({ schoolId, admissionNumber, name, className, guardianName, guardianPhone })),
      select: { id: true, admissionNumber: true },
    });
    const byAdmission = new Map(rows.map(row => [row.admissionNumber, row]));
    const openingCharges = students.flatMap(student => {
      const row = byAdmission.get(student.admissionNumber)!;
      return row.openingCents && row.openingDate ? [{ schoolId, openingStudentId: student.id, label: "Imported opening balance", amountCents: row.openingCents, dueOn: row.openingDate }] : [];
    });
    if (openingCharges.length) await tx.studentCharge.createMany({ data: openingCharges });
    await tx.auditEvent.createMany({ data: students.map(student => {
      const row = byAdmission.get(student.admissionNumber)!;
      return { schoolId, actorId: actor.id, actorName: actor.name, action: "STUDENT_IMPORTED", entityId: student.id,
        details: { admissionNumber: row.admissionNumber, openingCents: row.openingCents, dueOn: row.dueOn } };
    }) });
    return rows.length;
  });
}
