"use server";
import { schoolToday } from "@/services/fee-reports";


import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { readSession } from "@/lib/auth";
import { audit, inSchool, idSchema } from "@/services/fees";
import { studentRecord, savePrimaryGuardian } from "@/services/student-profile";
import { studentSchema } from "@/validators/student";
import { FeeRuleError } from "@/services/fee-calculations";
import { SchoolAccessError } from "@/services/school-permissions";
import { createStudent, updateStudent, DuplicateAdmissionNumberError, StudentAccessError, StudentConflictError } from "@/services/students";

export type StudentFormState = { error: string; success: string; fields: Record<string, string[]>; studentId?: string };

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
      await updateStudent({ id, updatedAt: formData.get("updatedAt") }, Object.fromEntries(formData), {
        readSession: async () => ({ role: "ADMIN" }), students: { updateMany: args => tx.student.updateMany({ where: { ...args.where, schoolId }, data: { ...studentRecord(args.data), updatedAt: args.data.updatedAt } }) },
      });
      await savePrimaryGuardian(tx, schoolId, id, studentSchema.parse(Object.fromEntries(formData)));
      const after = await tx.student.findUniqueOrThrow({ where: { id } });
      await audit(tx, user, schoolId, "STUDENT_UPDATED", id, { before: { name: before.name, admissionNumber: before.admissionNumber }, after: { name: after.name, admissionNumber: after.admissionNumber } });
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
  let studentId: string | undefined;
  try {
    const user = await readSession();
    if (!user) throw new StudentAccessError();
    const schoolId = idSchema.parse(formData.get("schoolId"));
    studentId = await inSchool(user, schoolId, "students", async tx => {
      const student = await createStudent(Object.fromEntries(formData), { readSession: async () => ({ role: "ADMIN" }), students: { create: args => tx.student.create({ data: { ...studentRecord(args.data), schoolId } }) } });
      await savePrimaryGuardian(tx, schoolId, student.id, studentSchema.parse(Object.fromEntries(formData)));
      await tx.studentStatusHistory.create({ data: { schoolId, studentId: student.id, newStatus: "ACTIVE", effectiveDate: new Date(`${schoolToday()}T00:00:00Z`), recordedById: user.id } });
      await audit(tx, user, schoolId, "STUDENT_CREATED", student.id, { name: student.name, admissionNumber: student.admissionNumber });
      return student.id;
    });
  } catch (error) {
    return formError(error);
  }
  revalidatePath("/admin/students");
  revalidatePath("/schools", "layout");
  return { error: "", success: "Student added successfully. Next, choose their academic year, class and section. Missing fees will be flagged on the account.", fields: {}, studentId };
}
