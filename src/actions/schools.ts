"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolAccess } from "@/lib/school";
import { FeeRuleError } from "@/services/fee-calculations";
import { SchoolAccessError } from "@/services/school-permissions";
import { audit, inSchool, createYear, createClass, createFeePlan, enrollStudent, recordPayment, recordDiscount, reversePayment } from "@/services/fees";

export type SchoolFormState = { error: string; success: string };
const initial = { error: "", success: "" };
function failure(error: unknown): SchoolFormState {
  if (error instanceof z.ZodError) return { ...initial, error: error.issues.map(issue => `${issue.path.join(".") || "Input"}: ${issue.message}`).join("; ") };
  if (error instanceof FeeRuleError || error instanceof SchoolAccessError) return { ...initial, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ...initial, error: "This record already exists. Check the existing records before submitting again." };
  return { ...initial, error: "The operation could not be completed. Check database connectivity and try again." };
}
async function actor() { const user = await readSession(); if (!user) throw new SchoolAccessError(); return user; }

export async function addSchool(_state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  let schoolId;
  try {
    const user = await actor();
    if (user.role !== "ADMIN") throw new SchoolAccessError();
    const data = z.object({ name: z.string().trim().min(1).max(100), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/, "Use 2–12 letters or digits") }).parse(Object.fromEntries(formData));
    const school = await prisma.$transaction(async tx => {
      const result = await tx.school.create({ data: { ...data, memberships: { create: { userId: user.id, role: "ADMIN", configureFees: true, manageAccess: true } } } });
      await audit(tx, user, result.id, "SCHOOL_CREATED", result.id, data);
      return result;
    });
    schoolId = school.id;
  } catch (error) { return failure(error); }
  (await cookies()).set("school-fee-active-school", schoolId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(`/schools/${schoolId}`);
}

export async function selectSchool(schoolId: string, destination: "students" | "school" = "school") {
  await schoolAccess(schoolId, destination === "students" ? "students" : "view");
  (await cookies()).set("school-fee-active-school", schoolId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(destination === "students" ? "/admin/students" : `/schools/${schoolId}`);
}

export async function grantAccess(schoolId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try {
    const user = await actor();
    const data = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGEMENT"]) }).parse(Object.fromEntries(formData));
    const configureFees = formData.get("configureFees") === "on", manageAccess = formData.get("manageAccess") === "on";
    await inSchool(user, schoolId, "access", async tx => {
      const target = await tx.user.findUnique({ where: { email: data.email } });
      if (!target?.active) throw new FeeRuleError("Provision an active staff account with this email first");
      if (target.id === user.id && !manageAccess) throw new FeeRuleError("You cannot remove your own staff-access permission");
      const before = await tx.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId: target.id } } });
      await tx.schoolMembership.upsert({ where: { schoolId_userId: { schoolId, userId: target.id } },
        create: { schoolId, userId: target.id, role: data.role, configureFees, manageAccess }, update: { role: data.role, configureFees, manageAccess } });
      await audit(tx, user, schoolId, "STAFF_ACCESS_CHANGED", target.id, { before: before ? { role: before.role, configureFees: before.configureFees, manageAccess: before.manageAccess } : null, after: { role: data.role, configureFees, manageAccess } });
    });
  } catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout");
  return { ...initial, success: "School access saved." };
}

export async function assignUnassignedStudent(schoolId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try {
    const user = await actor();
    // Unassigned records predate school scoping. Only original administration accounts may claim them.
    if (user.role !== "ADMIN") throw new SchoolAccessError();
    const studentId = z.string().min(1).max(128).parse(formData.get("studentId"));
    await inSchool(user, schoolId, "students", async tx => {
      const result = await tx.student.updateMany({ where: { id: studentId, schoolId: null }, data: { schoolId } });
      if (result.count !== 1) throw new FeeRuleError("This student is no longer unassigned");
      await audit(tx, user, schoolId, "LEGACY_STUDENT_ASSIGNED", studentId, { schoolId });
    });
  } catch (error) { return failure(error); }
  revalidatePath("/admin/students"); revalidatePath(`/schools/${schoolId}`, "layout");
  return { ...initial, success: "Student assigned to this school. Existing details were preserved." };
}

export async function setupSchool(schoolId: string, kind: "year" | "class" | "plan", _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try {
    const user = await actor();
    const data = Object.fromEntries(formData);
    if (kind === "year") await createYear(user, schoolId, data);
    else if (kind === "class") await createClass(user, schoolId, formData.get("name"));
    else {
      const raw = z.string().max(20_000).parse(formData.get("components"));
      let components;
      try { components = JSON.parse(raw); } catch { throw new FeeRuleError("Fee components must be valid"); }
      await createFeePlan(user, schoolId, { ...data, components });
    }
  } catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout");
  return { ...initial, success: "Configuration saved." };
}

export async function enroll(schoolId: string, studentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try { await enrollStudent(await actor(), schoolId, { ...Object.fromEntries(formData), studentId }); }
  catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout"); revalidatePath("/admin/students");
  return { ...initial, success: "Academic-year record saved. Class fees are assigned; previous dues are preserved." };
}

export async function pay(schoolId: string, studentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  let payment;
  try { payment = await recordPayment(await actor(), schoolId, { ...Object.fromEntries(formData), studentId }); }
  catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout");
  redirect(`/schools/${schoolId}/receipts/${payment.id}`);
}

export async function discount(schoolId: string, studentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try { await recordDiscount(await actor(), schoolId, { ...Object.fromEntries(formData), studentId }); }
  catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout");
  // Redirect issues a new submission key and prevents accidentally repeating a discount from the same form.
  redirect(`/schools/${schoolId}/students/${studentId}`);
}

export async function reverse(schoolId: string, paymentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  try { await reversePayment(await actor(), schoolId, { paymentId, reason: formData.get("reason") }); }
  catch (error) { return failure(error); }
  revalidatePath(`/schools/${schoolId}`, "layout");
  return { ...initial, success: "Payment reversed. Original receipt and audit history are retained; dues have been restored." };
}
