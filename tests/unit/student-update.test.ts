import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { updateStudent, StudentAccessError, StudentConflictError, DuplicateAdmissionNumberError } from "../../src/services/students";

const input = { dateOfBirth: "2010-05-10", admissionDate: "", name: " Example Student ", admissionNumber: " sch-001 ", guardianName: "Example Guardian", guardianPhone: "+49 123456789" };
const version = { id: "synthetic-student", updatedAt: "2026-11-13T00:00:00.000Z" };
const admin = async () => ({ role: "ADMIN" });

describe("student updates", () => {
  it.each([null, { role: "ACCOUNTANT" }, { role: "unknown" }])("rejects unauthorized updates before validating or writing", async session => {
    const updateMany = vi.fn();
    await expect(updateStudent({}, {}, { readSession: async () => session, students: { updateMany } })).rejects.toBeInstanceOf(StudentAccessError);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...version, id: "" }, input],
    [{ ...version, updatedAt: "invalid" }, input],
    [version, { ...input, name: "" }],
    [version, { ...input, guardianPhone: "123" }],
  ])("validates versions and fields before writing", async (candidate, data) => {
    const updateMany = vi.fn();
    await expect(updateStudent(candidate, data, { readSession: admin, students: { updateMany } })).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("normalizes fields, matches the original version, and advances it", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await updateStudent(version, { ...input, role: "ADMIN", id: "other-record" }, { readSession: admin, students: { updateMany } });
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: version.id, updatedAt: new Date(version.updatedAt) });
    expect(call.data).toEqual({ ...input, name: "Example Student", admissionNumber: "SCH-001", updatedAt: expect.any(Date) });
    expect(call.data.updatedAt.getTime()).toBeGreaterThan(new Date(version.updatedAt).getTime());
  });
  it("rejects stale or removed records", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    await expect(updateStudent(version, input, { readSession: admin, students: { updateMany } })).rejects.toBeInstanceOf(StudentConflictError);
  });
  it("reports duplicate admission numbers", async () => {
    const updateMany = vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    await expect(updateStudent(version, input, { readSession: admin, students: { updateMany } })).rejects.toBeInstanceOf(DuplicateAdmissionNumberError);
  });
});
