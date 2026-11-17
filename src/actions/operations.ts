"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { schoolAccess } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { FeeRuleError } from "@/services/fee-calculations";
import { SchoolAccessError } from "@/services/school-permissions";
import { importStudents, validateImport, validateImportPlacement } from "@/services/student-import";
import { bulkEnroll, assignStudentFees } from "@/services/bulk-enrollment";
import { correctCharge, reverseDiscount } from "@/services/fees";
import type { SchoolFormState } from "./schools";
import { bulkPromote } from "@/services/bulk-promotion";
import { createStaff, recoverStaffPassword, revokeStaffAccess } from "@/services/staff";
import { changeStudentStatus } from "@/services/student-status";

function message(error: unknown) {
  if (error instanceof FeeRuleError || error instanceof SchoolAccessError) return error.message;
  if (error instanceof z.ZodError) return error.issues.map(issue => issue.message).join("; ");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "A record already exists. Reload and check before retrying.";
  return "Could not complete this operation. Check database connectivity and try again.";
}

export async function saveStudentStatus(schoolId: string, studentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "students");
  try {
    await changeStudentStatus(user, schoolId, { ...Object.fromEntries(formData), studentId });
    revalidatePath(`/schools/${schoolId}`, "layout"); revalidatePath("/admin/students"); revalidatePath("/admin/dashboard");
    return { error: "", success: "Student status saved. All existing fees, payments and receipts are preserved." };
  } catch (error) { return { error: message(error), success: "" }; }
}
export async function previewStudentImport(schoolId: string, text: string) {
  await schoolAccess(schoolId, "students");
  try {
    const rows = validateImport(z.string().max(512_000).parse(text));
    await validateImportPlacement(prisma, schoolId, rows);
    return { error: "", rows: rows.map(({ admissionNumber, name, dateOfBirth, admissionDate, academicYear, className, sectionName, rollNumber, enrollmentDate, guardianName, guardianPhone, openingDue, dueOn }) => ({ admissionNumber, name, dateOfBirth, admissionDate, academicYear, className, sectionName, rollNumber, enrollmentDate, guardianName, guardianPhone, openingDue, dueOn })) };
  } catch (error) { return { error: message(error), rows: [] }; }
}
export async function confirmStudentImport(schoolId: string, text: string) {
  const { user } = await schoolAccess(schoolId, "students");
  try {
    const count = await importStudents(user, schoolId, z.string().max(512_000).parse(text));
    revalidatePath(`/schools/${schoolId}`, "layout"); revalidatePath("/admin/students");
    return { error: "", success: `Imported ${count} students. Opening dues saved. Enrollment fees are assigned only for explicitly provided academic years and classes.` };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function correctStudentCharge(schoolId: string, chargeId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "configure");
  try {
    await correctCharge(user, schoolId, { ...Object.fromEntries(formData), chargeId });
    revalidatePath(`/schools/${schoolId}`, "layout");
    return { error: "", success: "Charge corrected. Previous values and reason are retained in the audit trail." };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function reverseStudentDiscount(schoolId: string, discountId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "payments");
  try {
    await reverseDiscount(user, schoolId, { discountId, reason: formData.get("reason") });
    revalidatePath(`/schools/${schoolId}`, "layout");
    return { error: "", success: "Discount reversed. Original entry retained and dues restored." };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function promoteStudents(schoolId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "enroll");
  try {
    const count = await bulkPromote(user, schoolId, { ...Object.fromEntries(formData), studentIds: formData.getAll("studentIds") });
    revalidatePath(`/schools/${schoolId}`, "layout"); revalidatePath("/admin/students");
    return { error: "", success: `Saved ${count} promotions. Earlier records and dues are preserved.` };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function enrollStudents(schoolId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "enroll");
  try {
    const studentIds = z.array(z.string().min(1).max(128)).min(1).max(100).parse(formData.getAll("studentIds"));
    const count = await bulkEnroll(user, schoolId, { ...Object.fromEntries(formData), students: studentIds.map(studentId => ({ studentId, rollNumber: formData.get(`roll:${studentId}`) ?? "" })) });
    revalidatePath(`/schools/${schoolId}`, "layout"); revalidatePath("/admin/students");
    return { error: "", success: `Saved ${count} enrollments. Available full-year fees assigned; existing records and dues preserved.` };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function assignFees(schoolId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "assignFees");
  try {
    const result = await assignStudentFees(user, schoolId, { enrollmentIds: formData.getAll("enrollmentIds") });
    revalidatePath(`/schools/${schoolId}`, "layout");
    return { error: "", success: `Assigned full-year fees to ${result.assigned} enrollment(s). ${result.unchanged} already assigned and preserved.` };
  } catch (error) { return { error: message(error), success: "" }; }
}

export async function manageStaff(schoolId: string, operation: "create" | "recover" | "revoke", _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "access");
  try {
    z.enum(["create", "recover", "revoke"]).parse(operation);
    if (operation === "create") await createStaff(user, schoolId, Object.fromEntries(formData));
    else if (operation === "recover") await recoverStaffPassword(user, schoolId, Object.fromEntries(formData));
    else await revokeStaffAccess(user, schoolId, formData.get("userId"));
    revalidatePath(`/schools/${schoolId}`, "layout");
    return { error: "", success: operation === "create" ? "Staff account created with school membership." : operation === "recover" ? "Password reset and existing sessions revoked. Share the new password securely with the staff member." : "School access removed." };
  } catch (error) { return { error: message(error), success: "" }; }
}
