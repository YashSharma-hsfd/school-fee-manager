import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { SchoolAccessError } from "../../src/services/school-permissions";

const mocks = vi.hoisted(() => ({ session: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), enrollments: vi.fn(), plan: vi.fn(), inSchool: vi.fn(), audit: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ readSession: mocks.session }));
vi.mock("@/services/fees", async importOriginal => ({ ...await importOriginal<typeof import("../../src/services/fees")>(), inSchool: mocks.inSchool, audit: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { addStudent, editStudent } from "../../src/actions/students";

const initial = { error: "", success: "", fields: {} };
const student = { id: "synthetic", schoolId: "school-a", name: "Example Student", admissionNumber: "TEST-001", className: "7A", guardianName: "Example Guardian", guardianPhone: "+49 123456789" };
function form() {
  const data = new FormData();
  Object.entries({ ...student, admissionNumber: "test-001", updatedAt: "2026-11-13T00:00:00.000Z" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ id: "staff", name: "Example Admin", role: "ADMIN" });
  mocks.create.mockResolvedValue(student); mocks.findFirst.mockResolvedValue(student); mocks.findUniqueOrThrow.mockResolvedValue(student); mocks.enrollments.mockResolvedValue(0); mocks.plan.mockResolvedValue(null);
  mocks.inSchool.mockImplementation(async (_actor, _school, _permission, work) => work({ student: { create: mocks.create, updateMany: mocks.updateMany, findFirst: mocks.findFirst, findUniqueOrThrow: mocks.findUniqueOrThrow }, enrollment: { count: mocks.enrollments }, feePlan: { findFirst: mocks.plan } }));
});
describe("school-scoped student actions", () => {
  it("rejects anonymous submissions", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await addStudent(initial, form())).error).toContain("Administrator");
    expect(mocks.inSchool).not.toHaveBeenCalled();
  });
  it("rejects users without student-management permission for the school", async () => {
    mocks.inSchool.mockRejectedValue(new SchoolAccessError());
    expect((await editStudent("synthetic", initial, form())).error).toContain("permission");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("returns validation errors before saving", async () => {
    const data = form(); data.set("guardianPhone", "123");
    expect((await addStudent(initial, data)).fields.guardianPhone).toBeDefined();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("handles duplicate admission numbers", async () => {
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    expect((await addStudent(initial, form())).error).toContain("already exists");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("scopes creation and writes an audit event", async () => {
    expect((await addStudent(initial, form())).success).toContain("successfully");
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ schoolId: "school-a", admissionNumber: "TEST-001" }) });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.anything(), "school-a", "STUDENT_CREATED", "synthetic", expect.anything());
  });
  it("does not disclose database errors", async () => {
    mocks.create.mockRejectedValue(new Error("private database details"));
    expect((await addStudent(initial, form())).error).toBe("Could not save the student. Please try again.");
  });
  it("rejects edits to a student outside the school", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await editStudent("other-school-student", initial, form())).error).toContain("Administrator");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("preserves historical fees when a class change is attempted from the details form", async () => {
    mocks.enrollments.mockResolvedValue(1); const data = form(); data.set("className", "8A");
    expect((await editStudent("synthetic", initial, data)).error).toContain("Enroll / promote");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("shows stale record conflicts", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await editStudent("synthetic", initial, form())).error).toContain("changed or removed");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("scopes updates and redirects after saving", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    await expect(editStudent("synthetic", initial, form())).rejects.toThrow("redirect");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "synthetic", schoolId: "school-a" }) }));
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/students?saved=1");
  });
});
