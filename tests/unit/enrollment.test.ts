import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => ({ tx: {
  schoolMembership: { findUnique: vi.fn() }, student: { findFirst: vi.fn() },
  academicYear: { findFirst: vi.fn() }, schoolClass: { findFirst: vi.fn() }, classSection: { findFirst: vi.fn() },
  enrollment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  enrollmentFeeAssignment: { findUnique: vi.fn(), create: vi.fn() },
  feePlan: { findUnique: vi.fn() }, studentCharge: { createMany: vi.fn() }, auditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (work: (client: unknown) => unknown) => work(tx) } }));
import { enrollStudent } from "../../src/services/fees";

const actor = { id: "admin", name: "Synthetic admin", role: "ADMIN" as const };
const input = { studentId: "student", academicYearId: "year", classId: "class" };
const enrollment = { id: "enrollment", schoolId: "school", ...input, sectionId: null };
beforeEach(() => {
  vi.resetAllMocks();
  tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
  tx.student.findFirst.mockResolvedValue({ id: "student", status: "ACTIVE", admissionDate: null });
  tx.academicYear.findFirst.mockResolvedValue({ id: "year", startsOn: new Date("2026-04-01"), endsOn: new Date("2027-03-31"), isClosed: false });
  tx.schoolClass.findFirst.mockResolvedValue({ id: "class", isActive: true });
  tx.enrollment.create.mockResolvedValue(enrollment);
});
describe("academic enrollment independent of fee configuration", () => {
  it("saves enrollment without inventing charges when fees are missing", async () => {
    await expect(enrollStudent(actor, "school", input)).resolves.toEqual(enrollment);
    expect(tx.enrollmentFeeAssignment.create).not.toHaveBeenCalled();
    expect(tx.studentCharge.createMany).not.toHaveBeenCalled();
  });
  it("assigns fees once to an existing enrollment when a plan becomes available", async () => {
    tx.enrollment.findUnique.mockResolvedValue(enrollment);
    tx.feePlan.findUnique.mockResolvedValue({ id: "plan", items: [{ id: "item", label: "Tuition", amountPaise: 10001, dueOn: new Date("2026-04-10") }] });
    await enrollStudent(actor, "school", input);
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.studentCharge.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ enrollmentId: "enrollment", planItemId: "item", amountPaise: 10001 })] });
    vi.clearAllMocks();
    tx.enrollmentFeeAssignment.findUnique.mockResolvedValue({ id: "assignment" });
    await enrollStudent(actor, "school", input);
    expect(tx.studentCharge.createMany).not.toHaveBeenCalled();
  });
  it("rejects sections outside the selected class/year before recording enrollment", async () => {
    tx.classSection.findFirst.mockResolvedValue(null);
    await expect(enrollStudent(actor, "school", { ...input, sectionId: "other-section" })).rejects.toThrow("Section must belong");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });
  it("rejects a midyear placement change and dates outside the academic year", async () => {
    tx.enrollment.findUnique.mockResolvedValue({ ...enrollment, classId: "another-class" });
    await expect(enrollStudent(actor, "school", input)).rejects.toThrow("Existing placement");
    await expect(enrollStudent(actor, "school", { ...input, startsOn: "2025-01-01" })).rejects.toThrow("dates");
  });
  it("denies inactive membership even when the role is administrator", async () => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: "ADMIN", isActive: false });
    await expect(enrollStudent(actor, "school", input)).rejects.toThrow("permission");
    expect(tx.student.findFirst).not.toHaveBeenCalled();
  });
});
