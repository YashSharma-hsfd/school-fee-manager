import { describe, expect, it } from "vitest";
import { importHeaders, parseCsv, validateImport } from "../../src/services/student-import";

const header = importHeaders.join(",") + "\r\n";
const row = 'a-1,"Example, Student",5A,Example Guardian,+49123456789,100.01,2020-04-01';
describe("student import", () => {
  it("parses Excel CSV with BOM, quotes and multiline cells", () => {
    expect(parseCsv('\uFEFFa,b\r\n"one,""two""","three\nfour"\r\n')).toEqual([["a", "b"], ['one,"two"', "three\nfour"]]);
  });
  it("normalizes admissions and converts opening balances exactly", () => {
    const [student] = validateImport(header + row);
    expect(student.admissionNumber).toBe("A-1");
    expect(student.openingCents).toBe(10001);
    expect(student.openingDate?.toISOString()).toBe("2020-04-01T00:00:00.000Z");
  });
  it("rejects duplicate admissions, malformed CSV and invalid balances", () => {
    expect(() => validateImport(header + row + "\n" + row)).toThrow("duplicate");
    expect(() => parseCsv('"open')).toThrow("Unclosed");
    expect(() => parseCsv('"closed"x')).toThrow("Malformed");
    expect(() => validateImport(header + row.replace("100.01", "-1"))).toThrow("Invalid opening due");
    expect(() => validateImport(header + row.replace("2020-04-01", ""))).toThrow("valid due date");
    expect(() => validateImport("name\nExample")).toThrow("exact columns");
  });
  it("allows zero opening dues without a date and enforces size limits", () => {
    expect(validateImport(header + row.replace("100.01,2020-04-01", "0,"))[0].openingCents).toBe(0);
    expect(() => parseCsv("x".repeat(512001))).toThrow("512 KB");
    expect(() => validateImport(header + Array(501).fill(row).join("\n"))).toThrow("500");
  });
});
