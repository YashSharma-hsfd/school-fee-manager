import { describe, expect, it } from "vitest";
import { importHeaders, optionalImportHeaders, parseCsv, validateImport, validateImportPlacement } from "../../src/services/student-import";
import type { Prisma } from "@prisma/client";

const header = importHeaders.join(",") + "\r\n";
const row = 'a-1,"Example, Student",2010-05-10,,,,Example Guardian,+49123456789,100.01,2020-04-01';
describe("student import", () => {
  it("parses Excel CSV with BOM, quotes and multiline cells", () => {
    expect(parseCsv('\uFEFFa,b\r\n"one,""two""","three\nfour"\r\n')).toEqual([["a", "b"], ['one,"two"', "three\nfour"]]);
  });
  it("normalizes admissions and converts opening balances exactly", () => {
    const [student] = validateImport(header + row);
    expect(student.admissionNumber).toBe("A-1");
    expect(student.openingPaise).toBe(10001);
    expect(student.openingDate?.toISOString()).toBe("2020-04-01T00:00:00.000Z");
  });
  it("rejects duplicate admissions, malformed CSV and invalid balances", () => {
    expect(() => validateImport(header + row + "\n" + row)).toThrow("duplicate");
    expect(() => parseCsv('"open')).toThrow("Unclosed");
    expect(() => parseCsv('"closed"x')).toThrow("Malformed");
    expect(() => validateImport(header + row.replace("100.01", "-1"))).toThrow("Invalid opening due");
    expect(() => validateImport(header + row.replace("2020-04-01", ""))).toThrow("valid due date");
    expect(() => validateImport("name\nExample")).toThrow("Required columns");
  });
  it("allows zero opening dues without a date and enforces size limits", () => {
    expect(validateImport(header + row.replace("100.01,2020-04-01", "0,"))[0].openingPaise).toBe(0);
    expect(() => parseCsv("x".repeat(512001))).toThrow("512 KB");
    expect(() => validateImport(header + Array(501).fill(row).join("\n"))).toThrow("500");
  });
  it("supports optional placement columns, reordered columns and legacy templates", () => {
    const headers = [...importHeaders, ...optionalImportHeaders].reverse();
    const values = { ...validateImport(header + row)[0], academicYear: "2026-27", className: "5", sectionName: "A", rollNumber: "001", enrollmentDate: "2026-11-01", name: "Synthetic" };
    const [student] = validateImport(headers.join(",") + "\n" + headers.map(name => values[name as keyof typeof values]).join(","));
    expect(student).toMatchObject({ sectionName: "A", rollNumber: "001", enrollmentDate: "2026-11-01" });
    expect(validateImport(header + row)[0].sectionName).toBe("");
  });
  it("reports every invalid row and rejects incomplete placement and duplicate column names", () => {
    expect(() => validateImport(header + row.replace("2010-05-10", "") + "\n" + row.replace("100.01", "-1"))).toThrow(/Row 2:[\s\S]*Row 3:/);
    expect(() => validateImport(importHeaders.join(",") + ",rollNumber\n" + row + ",1")).toThrow("require an academic year");
    expect(() => validateImport(importHeaders.join(",") + ",name\n" + row + ",Student")).toThrow("Required columns");
    expect(() => validateImport(header + row.replace("2010-05-10,,,,", "2010-05-10,2009-01-01,,,"))).toThrow("Admission date");
  });
  it("previews placement and roll conflicts within the file and school database", async () => {
    const tx = {
      student: { findMany: async () => [{ admissionNumber: "A-1" }] },
      academicYear: { findMany: async () => [{ id: "year", name: "2026-27", startsOn: new Date("2026-04-01"), endsOn: new Date("2027-03-31"), isClosed: false }] },
      schoolClass: { findMany: async () => [{ id: "class", name: "5", isActive: true }] },
      classSection: { findMany: async () => [{ id: "section", name: "A", academicYearId: "year", classId: "class", isActive: true }] },
      enrollment: { findMany: async () => [{ academicYearId: "year", classId: "class", sectionId: "section", rollNumber: "001" }] },
    } as unknown as Prisma.TransactionClient;
    const base = { ...validateImport(header + row)[0], academicYear: "2026-27", className: "5", sectionName: "A", rollNumber: "001", enrollmentDate: "2026-11-01" };
    await expect(validateImportPlacement(tx, "school", [base, { ...base, admissionNumber: "A-2" }])).rejects.toThrow(/Row 2:[\s\S]*Row 3:/);
    await expect(validateImportPlacement(tx, "school", [{ ...base, admissionNumber: "A-2", sectionName: "Other" }])).rejects.toThrow("Section must");
    await expect(validateImportPlacement(tx, "school", [{ ...base, admissionNumber: "A-2", enrollmentDate: "2027-04-01" }])).rejects.toThrow("within the academic year");
    const [placement] = await validateImportPlacement(tx, "school", [{ ...base, admissionNumber: "A-2", rollNumber: "002" }]);
    expect(placement).toMatchObject({ academicYearId: "year", classId: "class", sectionId: "section", rollNumber: "002", startsOn: new Date("2026-11-01") });
  });
});
