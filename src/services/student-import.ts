import { schoolToday } from "./fee-reports";
import { z } from "zod";
import { studentSchema } from "@/validators/student";
import { dateSchema, FeeRuleError, moneySchema } from "./fee-calculations";
import { studentRecord, savePrimaryGuardian } from "./student-profile";
import { enrollInTransaction, inSchool } from "./fees";
import type { SessionUser } from "./auth";
import type { Prisma } from "@prisma/client";

export const importHeaders = ["admissionNumber", "name", "dateOfBirth", "admissionDate", "academicYear", "className", "guardianName", "guardianPhone", "openingDue", "dueOn"];
export const optionalImportHeaders = ["sectionName", "rollNumber", "enrollmentDate"];

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
  academicYear: z.string().trim().max(100).default(""), className: z.string().trim().max(60).default(""),
  openingDue: z.string().trim().default(""), dueOn: z.string().trim().default(""),
  sectionName: z.string().trim().max(60).default(""), rollNumber: z.string().trim().max(40).default(""), enrollmentDate: z.string().trim().default(""),
}).transform((row, ctx) => {
  if ((row.sectionName || row.rollNumber || row.enrollmentDate) && !row.academicYear) { ctx.addIssue({ code: "custom", message: "Section, roll number and enrollment date require an academic year and class" }); return z.NEVER; }
  if (row.enrollmentDate && !dateSchema.safeParse(row.enrollmentDate).success) { ctx.addIssue({ code: "custom", message: "Invalid enrollment date" }); return z.NEVER; }
  if (!!row.academicYear !== !!row.className) { ctx.addIssue({ code: "custom", message: "Provide both academic year and class, or leave both empty" }); return z.NEVER; }
  const amount = !row.openingDue || /^(0|0\.0{1,2})$/.test(row.openingDue) ? 0 : moneySchema.safeParse(row.openingDue);
  if (amount !== 0 && !amount.success) { ctx.addIssue({ code: "custom", message: "Invalid opening due" }); return z.NEVER; }
  const openingPaise = amount === 0 ? 0 : amount.data;
  const due = row.dueOn ? dateSchema.safeParse(row.dueOn) : null;
  if ((openingPaise > 0 && !due) || (due && !due.success)) { ctx.addIssue({ code: "custom", message: "Opening dues require a valid due date" }); return z.NEVER; }
  return { ...row, openingPaise, openingDate: due?.success ? due.data : null };
});

export function validateImport(text: string) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers || new Set(headers).size !== headers.length || importHeaders.some(name => !headers.includes(name)) || headers.some(name => ![...importHeaders, ...optionalImportHeaders].includes(name))) throw new FeeRuleError(`Required columns: ${importHeaders.join(",")}. Optional: ${optionalImportHeaders.join(",")}. Columns may be reordered.`);
  if (!rows.length) throw new FeeRuleError("Add at least one student");
  const seen = new Set<string>();
  const errors: string[] = [];
  const parsedRows = rows.flatMap((row, index) => {
    try {
    if (row.length !== headers.length) throw new FeeRuleError(`Row ${index + 2}: expected ${headers.length} columns`);
    const parsed = rowSchema.safeParse(Object.fromEntries(headers.map((name, i) => [name, row[i]])));
    if (!parsed.success) throw new FeeRuleError(`Row ${index + 2}: ${parsed.error.issues.map(issue => issue.message).join("; ")}`);
    if (seen.has(parsed.data.admissionNumber)) throw new FeeRuleError(`Row ${index + 2}: duplicate admission number`);
    seen.add(parsed.data.admissionNumber);
    studentRecord(parsed.data);
    return [parsed.data];
    } catch (error) { errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message.replace(/^Row \d+: /, "") : "Invalid student"}`); return []; }
  });
  if (errors.length) throw new FeeRuleError(errors.join("\n"));
  return parsedRows;
}

// Shared by preview and the final serializable transaction; a stale preview cannot bypass validation.
export async function validateImportPlacement(tx: Prisma.TransactionClient, schoolId: string, rows: ReturnType<typeof validateImport>) {
  const [existing, years, classes, sections, rolls] = await Promise.all([
    tx.student.findMany({ where: { schoolId, admissionNumber: { in: rows.map(row => row.admissionNumber) } }, select: { admissionNumber: true } }),
    tx.academicYear.findMany({ where: { schoolId } }), tx.schoolClass.findMany({ where: { schoolId } }),
    tx.classSection.findMany({ where: { schoolId } }),
    tx.enrollment.findMany({ where: { schoolId, rollNumber: { in: rows.flatMap(row => row.rollNumber ? [row.rollNumber] : []) } }, select: { academicYearId: true, classId: true, sectionId: true, rollNumber: true } }),
  ]);
  const seen = new Set(rolls.map(row => JSON.stringify([row.academicYearId, row.classId, row.sectionId, row.rollNumber])));
  const errors: string[] = [];
  const placements = rows.map((row, index) => {
    const fail = (message: string) => errors.push(`Row ${index + 2}: ${message}`);
    if (existing.some(student => student.admissionNumber === row.admissionNumber)) fail(`Admission number ${row.admissionNumber} already exists`);
    if (!row.academicYear) return null;
    const year = years.find(item => item.name === row.academicYear), schoolClass = classes.find(item => item.name === row.className);
    if (!year || year.isClosed || !schoolClass?.isActive) { fail("Select an existing open year and active class in this school"); return null; }
    const section = row.sectionName ? sections.find(item => item.name === row.sectionName && item.academicYearId === year.id && item.classId === schoolClass.id && item.isActive) : null;
    if (row.sectionName && !section) fail("Section must be active and belong to this class and year");
    const startsOn = row.enrollmentDate ? new Date(`${row.enrollmentDate}T00:00:00Z`) : row.admissionDate && new Date(`${row.admissionDate}T00:00:00Z`) > year.startsOn ? new Date(`${row.admissionDate}T00:00:00Z`) : year.startsOn;
    if (startsOn < year.startsOn || startsOn > year.endsOn) fail("Enrollment date must fall within the academic year");
    if (row.rollNumber) {
      const key = JSON.stringify([year.id, schoolClass.id, section?.id ?? null, row.rollNumber]);
      if (seen.has(key)) fail(`Roll number ${row.rollNumber} is already used in this year, class and section`);
      seen.add(key);
    }
    return { academicYearId: year.id, classId: schoolClass.id, sectionId: section?.id ?? "", rollNumber: row.rollNumber, startsOn };
  });
  if (errors.length) throw new FeeRuleError(errors.join("\n"));
  return placements;
}

export async function importStudents(actor: SessionUser, schoolId: string, text: string) {
  const rows = validateImport(text);
  return inSchool(actor, schoolId, "students", async tx => {
    const placements = await validateImportPlacement(tx, schoolId, rows);
    const students = await tx.student.createManyAndReturn({
      data: rows.map(row => ({ schoolId, ...studentRecord(row) })),
      select: { id: true, admissionNumber: true },
    });
    const byAdmission = new Map(rows.map(row => [row.admissionNumber, row]));
    const placementByAdmission = new Map(rows.map((row, index) => [row.admissionNumber, placements[index]]));
    for (const student of students) {
      const row = byAdmission.get(student.admissionNumber)!;
      await savePrimaryGuardian(tx, schoolId, student.id, row);
      await tx.studentStatusHistory.create({ data: { schoolId, studentId: student.id, newStatus: "ACTIVE", effectiveDate: new Date(`${schoolToday()}T00:00:00Z`), recordedById: actor.id } });
      if (row.academicYear) {
        await enrollInTransaction(tx, actor, schoolId, { studentId: student.id, ...placementByAdmission.get(student.admissionNumber)! });
      }
    }
    const openingCharges = students.flatMap(student => {
      const row = byAdmission.get(student.admissionNumber)!;
      return row.openingPaise && row.openingDate ? [{ schoolId, openingStudentId: student.id, label: "Imported opening balance", amountPaise: row.openingPaise, dueOn: row.openingDate }] : [];
    });
    if (openingCharges.length) await tx.studentCharge.createMany({ data: openingCharges });
    await tx.auditEvent.createMany({ data: students.map(student => {
      const row = byAdmission.get(student.admissionNumber)!;
      return { schoolId, actorId: actor.id, actorName: actor.name, action: "STUDENT_IMPORTED", entityType: "Student", entityId: student.id,
        details: { admissionNumber: row.admissionNumber, openingPaise: row.openingPaise, dueOn: row.dueOn } };
    }) });
    return rows.length;
  });
}
