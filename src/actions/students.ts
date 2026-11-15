"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { readSession } from "@/lib/auth";
import { audit, inSchool, idSchema, enrollInTransaction } from "@/services/fees";
import { schoolToday } from "@/services/fee-reports";
import { FeeRuleError } from "@/services/fee-calculations";
import { SchoolAccessError } from "@/services/school-permissions";
import { createStudent, updateStudent, DuplicateAdmissionNumberError, StudentAccessError, StudentConflictError } from "@/services/students";

export type StudentFormState = { error: string; success: string; fields: Record<string, string[]> };

function formError(error: unknown): StudentFormState {
  if (error instanceof ZodError) return { error: "Check the highlighted fields. If the problem persists, reload the page.", success: "", fields: error.flatten().fieldErrors };
  if (error instanceof StudentAccessError || error instanceof DuplicateAdmissionNumberError || error instanceof StudentConflictError || error instanceof FeeRuleError || error instanceof SchoolAccessError) {
    return { error: error.message, success: "", fields: {} };
  }
  return { error: "Could not save the student. Please try again.", success: "", fields: {} };
}

export async function editStudent(id: string, _state: StudentFormState, formData: FormData): Promise<StudentFormState> {
  try {
    const user = await readSession();
    if (!user) throw new StudentAccessError();
    const schoolId = idSchema.parse(formData.get("schoolId"));
    await inSchool(user, schoolId, "students", async tx => {
      const before = await tx.student.findFirst({ where: { id, schoolId } });
      if (!before) throw new StudentAccessError();
      if (before.className !== String(formData.get("className")).trim() && await tx.enrollment.count({ where: { schoolId, studentId: id } })) {
        throw new FeeRuleError("Use Enroll / promote on the student account to change class after fees have been assigned. Existing charges must be preserved.");
      }
      await updateStudent({ id, updatedAt: formData.get("updatedAt") }, Object.fromEntries(formData), {
        readSession: async () => ({ role: "ADMIN" }), students: { updateMany: args => tx.student.updateMany({ ...args, where: { ...args.where, schoolId } }) },
      });
      const after = await tx.student.findUniqueOrThrow({ where: { id } });
      await audit(tx, user, schoolId, "STUDENT_UPDATED", id, { before: { name: before.name, admissionNumber: before.admissionNumber, className: before.className, guardianName: before.guardianName, guardianPhone: before.guardianPhone }, after: { name: after.name, admissionNumber: after.admissionNumber, className: after.className, guardianName: after.guardianName, guardianPhone: after.guardianPhone } });
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${encodeURIComponent(id)}/edit`);
  revalidatePath("/schools", "layout");
  redirect("/admin/students?saved=1");
}

export async function addStudent(_state: StudentFormState, formData: FormData): Promise<StudentFormState> {
  try {
    const user = await readSession();
    if (!user) throw new StudentAccessError();
    const schoolId = idSchema.parse(formData.get("schoolId"));
    await inSchool(user, schoolId, "students", async tx => {
      const student = await createStudent(Object.fromEntries(formData), { readSession: async () => ({ role: "ADMIN" }), students: { create: args => tx.student.create({ data: { ...args.data, schoolId } }) } });
      await audit(tx, user, schoolId, "STUDENT_CREATED", student.id, { name: student.name, admissionNumber: student.admissionNumber, className: student.className });
      const today = new Date(`${schoolToday()}T00:00:00.000Z`);
      const plan = await tx.feePlan.findFirst({ where: { schoolId, schoolClass: { name: { equals: student.className, mode: "insensitive" } }, academicYear: { startsOn: { lte: today }, endsOn: { gte: today } } } });
      if (plan) await enrollInTransaction(tx, user, schoolId, { studentId: student.id, academicYearId: plan.academicYearId, classId: plan.classId });
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/admin/students");
  revalidatePath("/schools", "layout");
  return { error: "", success: "Student added successfully. Current-year fees are assigned automatically when a matching class fee plan exists. Check the student account for details.", fields: {} };
}
