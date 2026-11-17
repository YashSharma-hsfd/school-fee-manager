import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => ({ tx: {
  schoolMembership: { findUnique: vi.fn() }, student: { findFirst: vi.fn(), update: vi.fn() },
  studentStatusHistory: { create: vi.fn() }, feePlan: { findUnique: vi.fn() }, auditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (work: (client: unknown) => unknown) => work(tx) } }));
import { changeStudentStatus, studentFilterSchema } from "../../src/services/student-status";
import { enrollStudent } from "../../src/services/fees";

const actor = { id: "admin", name: "Synthetic Admin", role: "ADMIN" as const };
const version = "2026-04-01T00:00:00.000Z";
const input = { studentId: "student", status: "WITHDRAWN", reason: "Moved to another school", expectedUpdatedAt: version };
describe("student lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN" });
    tx.student.findFirst.mockResolvedValue({ id: "student", status: "ACTIVE", updatedAt: new Date(version) });
  });
  it("requires school administration and scopes the selected student", async () => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ACCOUNTANT" });
    await expect(changeStudentStatus(actor, "school", input)).rejects.toThrow("permission");
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN" });
    tx.student.findFirst.mockResolvedValue(null);
    await expect(changeStudentStatus(actor, "other-school", input)).rejects.toThrow("not found");
    expect(tx.student.findFirst).toHaveBeenCalledWith({ where: { schoolId: "other-school", id: "student" } });
    expect(tx.student.update).not.toHaveBeenCalled();
  });
  it("requires a reason and a valid state", async () => {
    await expect(changeStudentStatus(actor, "school", { ...input, reason: "" })).rejects.toThrow();
    await expect(changeStudentStatus(actor, "school", { ...input, status: "DELETED" })).rejects.toThrow();
    expect(tx.student.update).not.toHaveBeenCalled();
  });
  it("rejects stale forms and does not change any ledger records", async () => {
    await expect(changeStudentStatus(actor, "school", { ...input, expectedUpdatedAt: "2025-04-01T00:00:00.000Z" })).rejects.toThrow("Student changed");
    expect(tx.student.update).not.toHaveBeenCalled();
    await changeStudentStatus(actor, "school", input);
    expect(tx.student.update).toHaveBeenCalledWith({ where: { id: "student" }, data: { status: "WITHDRAWN", statusReason: input.reason, statusChangedAt: expect.any(Date), updatedAt: expect.any(Date) } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ schoolId: "school", action: "STUDENT_STATUS_CHANGED", entityId: "student", details: { before: "ACTIVE", after: "WITHDRAWN", reason: input.reason, changedAt: expect.any(String) } }) });
  });
  it("makes retries harmless and permits audited reactivation", async () => {
    tx.student.findFirst.mockResolvedValue({ id: "student", status: "WITHDRAWN", updatedAt: new Date(version) });
    await changeStudentStatus(actor, "school", input);
    expect(tx.student.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    await changeStudentStatus(actor, "school", { ...input, status: "ACTIVE", reason: "Student returned" });
    expect(tx.student.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE", statusReason: "Student returned" }) }));
  });
  it.each(["INACTIVE", "WITHDRAWN"])("blocks enrollment while %s before looking up a plan", async status => {
    tx.student.findFirst.mockResolvedValue({ id: "student", status });
    await expect(enrollStudent(actor, "school", { studentId: "student", academicYearId: "year", classId: "class" })).rejects.toThrow("Reactivate");
    expect(tx.feePlan.findUnique).not.toHaveBeenCalled();
  });
  it("defaults directories to active students and supports explicit historical searches", () => {
    expect(studentFilterSchema.parse(undefined)).toBe("ACTIVE");
    expect(studentFilterSchema.parse("WITHDRAWN")).toBe("WITHDRAWN");
    expect(studentFilterSchema.parse("ALL")).toBe("ALL");
  });
});
