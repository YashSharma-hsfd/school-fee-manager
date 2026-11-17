import { beforeEach, describe, expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({ tx: {
  schoolMembership: { findUnique: vi.fn() }, student: { findFirst: vi.fn() },
  academicYear: { findFirst: vi.fn() }, schoolClass: { findFirst: vi.fn() }, classSection: { findFirst: vi.fn() },
  enrollment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  enrollmentFeeAssignment: { findUnique: vi.fn(), create: vi.fn() },
  feePlan: { findUnique: vi.fn() }, studentCharge: { createMany: vi.fn() }, auditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (work: (client: unknown) => unknown) => work(tx) } }));
import { bulkEnroll, assignStudentFees } from "../../src/services/bulk-enrollment";
import { assertSchoolPermission } from "../../src/services/school-permissions";

const actor = { id: "manager", name: "Synthetic", role: "MANAGEMENT" as const };
const input = { academicYearId: "year", classId: "class", students: [{ studentId: "student", rollNumber: "001" }] };
const enrollment = { id: "enrollment", academicYearId: "year", classId: "class", studentId: "student", sectionId: null, rollNumber: "001", feeAssignment: null };
const items = [{ id: "april", label: "Tuition", amountPaise: 60000, dueOn: new Date("2026-04-10") }, { id: "october", label: "Tuition", amountPaise: 60000, dueOn: new Date("2026-10-10") }];
beforeEach(() => {
  vi.resetAllMocks();
  tx.schoolMembership.findUnique.mockResolvedValue({ role: "MANAGEMENT", isActive: true, canConfigureFees: true, canManageAccess: true });
  tx.student.findFirst.mockResolvedValue({ id: "student", status: "ACTIVE", admissionDate: null });
  tx.academicYear.findFirst.mockResolvedValue({ id: "year", startsOn: new Date("2026-04-01"), endsOn: new Date("2027-03-31"), isClosed: false });
  tx.schoolClass.findFirst.mockResolvedValue({ id: "class", isActive: true });
  tx.enrollment.create.mockResolvedValue(enrollment);
  tx.enrollment.findMany.mockResolvedValue([enrollment]);
  tx.feePlan.findUnique.mockResolvedValue({ id: "plan", items });
});

describe("bulk enrollment and assignment", () => {
  it("allows management to enroll a student with no earlier enrollment and charges the entire year for a midyear start", async () => {
    await expect(bulkEnroll(actor, "school", { ...input, startsOn: "2026-11-01" })).resolves.toBe(1);
    expect(tx.studentCharge.createMany).toHaveBeenCalledWith({ data: items.map(item => expect.objectContaining({ planItemId: item.id, amountPaise: item.amountPaise, dueOn: item.dueOn })) });
    expect(tx.enrollment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ rollNumber: "001", startsOn: new Date("2026-11-01") }) });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "FEES_ASSIGNED", actorId: actor.id }) });
  });
  it("preserves existing placement and charges on a repeated enrollment", async () => {
    tx.enrollment.findUnique.mockResolvedValue(enrollment);
    tx.enrollmentFeeAssignment.findUnique.mockResolvedValue({ id: "assignment" });
    await bulkEnroll(actor, "school", input);
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.studentCharge.createMany).not.toHaveBeenCalled();
  });
  it("rejects roll collisions and conflicting repeat rolls before writing", async () => {
    tx.enrollment.findFirst.mockResolvedValue({ id: "someone-else" });
    await expect(bulkEnroll(actor, "school", input)).rejects.toThrow("already used");
    tx.enrollment.findUnique.mockResolvedValue({ ...enrollment, rollNumber: "002" });
    await expect(bulkEnroll(actor, "school", input)).rejects.toThrow("different roll number");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
  it("rejects duplicate student IDs, duplicate rolls and oversized batches", async () => {
    await expect(bulkEnroll(actor, "school", { ...input, students: [input.students[0], input.students[0]] })).rejects.toThrow("Duplicate student");
    await expect(bulkEnroll(actor, "school", { ...input, students: [...input.students, { studentId: "other", rollNumber: "001" }] })).rejects.toThrow("Duplicate roll");
    await expect(bulkEnroll(actor, "school", { ...input, students: Array.from({ length: 101 }, (_, i) => ({ studentId: `s${i}` })) })).rejects.toThrow();
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
  it("checks student and enrollment school scope", async () => {
    tx.student.findFirst.mockResolvedValue(null);
    await expect(bulkEnroll(actor, "school", input)).rejects.toThrow("this school");
    expect(tx.student.findFirst).toHaveBeenCalledWith({ where: { schoolId: "school", id: "student" } });
    tx.enrollment.findMany.mockResolvedValue([]);
    await expect(assignStudentFees(actor, "school", { enrollmentIds: ["foreign"] })).rejects.toThrow("this school");
    expect(tx.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: "school", id: { in: ["foreign"] } } }));
  });
  it("assigns only an existing matching plan and safely skips an existing assignment", async () => {
    await expect(assignStudentFees(actor, "school", { enrollmentIds: ["enrollment"] })).resolves.toEqual({ assigned: 1, unchanged: 0 });
    tx.enrollment.findMany.mockResolvedValue([{ ...enrollment, feeAssignment: { id: "assignment" } }]);
    tx.enrollmentFeeAssignment.findUnique.mockResolvedValue({ id: "assignment" });
    tx.studentCharge.createMany.mockClear();
    await expect(assignStudentFees(actor, "school", { enrollmentIds: ["enrollment"] })).resolves.toEqual({ assigned: 0, unchanged: 1 });
    expect(tx.studentCharge.createMany).not.toHaveBeenCalled();
  });
  it("checks all selected plans before creating any charges", async () => {
    tx.enrollment.findMany.mockResolvedValue([enrollment, { ...enrollment, id: "second", classId: "no-plan" }]);
    tx.feePlan.findUnique.mockResolvedValueOnce({ id: "plan", items }).mockResolvedValueOnce(null);
    await expect(assignStudentFees(actor, "school", { enrollmentIds: ["enrollment", "second"] })).rejects.toThrow("No fees were assigned");
    expect(tx.studentCharge.createMany).not.toHaveBeenCalled();
  });
  it.each(["ACCOUNTANT", "inactive"])("denies enrollment and assignment for %s", async role => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: role === "inactive" ? "MANAGEMENT" : role, isActive: role !== "inactive" });
    await expect(bulkEnroll(actor, "school", input)).rejects.toThrow("permission");
    await expect(assignStudentFees(actor, "school", { enrollmentIds: ["enrollment"] })).rejects.toThrow("permission");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
  it.each(["students", "payments", "configure", "access"] as const)("denies management %s even with stale privileged flags", permission => {
    expect(() => assertSchoolPermission({ role: "MANAGEMENT", canConfigureFees: true, canManageAccess: true }, permission)).toThrow("permission");
  });
});
