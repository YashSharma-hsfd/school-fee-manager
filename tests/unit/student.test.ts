import { describe, expect, it } from "vitest";
import { studentSchema } from "../../src/validators/student";
describe("student input", () => { it("rejects blank identifiers", () => { expect(studentSchema.safeParse({ name: " ", admissionNumber: "" }).success).toBe(false); }); it("trims valid input", () => { expect(studentSchema.parse({ name: " Asha ", admissionNumber: " 001 " })).toEqual({ name: "Asha", admissionNumber: "001" }); }); });

