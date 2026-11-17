import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { studentSchema } from "../../src/validators/student";
import { createStudent, DuplicateAdmissionNumberError, StudentAccessError } from "../../src/services/students";

const input = { dateOfBirth: "2010-05-10", admissionDate: "", name: " Asha Example ", admissionNumber: " sch-001 ", className: " 5 A ", guardianName: " Example Guardian ", guardianPhone: " +49 123 456789 " };

describe("student input", () => {
  it("trims fields and normalizes admission numbers", () => {
    expect(studentSchema.parse(input)).toEqual({ dateOfBirth: "2010-05-10", admissionDate: "", name: "Asha Example", admissionNumber: "SCH-001", guardianName: "Example Guardian", guardianPhone: "+49 123 456789" });
  });
  it.each(["name", "admissionNumber", "dateOfBirth"])("rejects a blank %s", key => {
    expect(studentSchema.safeParse({ ...input, [key]: " " }).success).toBe(false);
  });
  it.each(["abc", "123", "1234567<script>"])("rejects invalid phone %s", guardianPhone => {
    expect(studentSchema.safeParse({ ...input, guardianPhone }).success).toBe(false);
  });
});

describe("student creation", () => {
  it.each([null, { role: "ACCOUNTANT" }, { role: "unknown" }])("denies unauthorized sessions before writing", async session => {
    const create = vi.fn();
    await expect(createStudent(input, { readSession: async () => session, students: { create } })).rejects.toBeInstanceOf(StudentAccessError);
    expect(create).not.toHaveBeenCalled();
  });
  it("validates before writing", async () => {
    const create = vi.fn();
    await expect(createStudent({}, { readSession: async () => ({ role: "ADMIN" }), students: { create } })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("writes normalized data for an administrator", async () => {
    const create = vi.fn().mockResolvedValue({ id: "synthetic-student" });
    await expect(createStudent(input, { readSession: async () => ({ role: "ADMIN" }), students: { create } })).resolves.toEqual({ id: "synthetic-student" });
    expect(create).toHaveBeenCalledExactlyOnceWith({ data: studentSchema.parse(input) });
  });
  it("translates database duplicate errors", async () => {
    const create = vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "6" }));
    await expect(createStudent(input, { readSession: async () => ({ role: "ADMIN" }), students: { create } })).rejects.toBeInstanceOf(DuplicateAdmissionNumberError);
  });
  it("preserves unexpected database failures", async () => {
    const error = new Error("Database unavailable");
    const create = vi.fn().mockRejectedValue(error);
    await expect(createStudent(input, { readSession: async () => ({ role: "ADMIN" }), students: { create } })).rejects.toBe(error);
  });
});
