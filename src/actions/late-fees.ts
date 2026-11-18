"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { schoolAccess } from "@/lib/school";
import { configureLateFees } from "@/services/late-fees";
import { recordDiscount } from "@/services/fees";
import { FeeRuleError } from "@/services/fee-calculations";
import { SchoolAccessError } from "@/services/school-permissions";
import type { SchoolFormState } from "./schools";

export async function saveLateFeePolicy(schoolId: string, feePlanId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "configure");
  try {
    await configureLateFees(user, schoolId, { ...Object.fromEntries(formData), feePlanId });
    revalidatePath(`/schools/${schoolId}`, "layout");
    return { error: "", success: "Late-fee policy saved. It applies from the selected date; posted charges and receipts are preserved." };
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join("; ") : error instanceof FeeRuleError || error instanceof SchoolAccessError ? error.message : "Could not save the late-fee policy. Please try again.", success: "" };
  }
}

export async function waiveStudentLateFees(schoolId: string, studentId: string, _state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const { user } = await schoolAccess(schoolId, "payments");
  try {
    await recordDiscount(user, schoolId, { ...Object.fromEntries(formData), studentId, scope: "LATE_FEES" });
    revalidatePath(`/schools/${schoolId}`, "layout");
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join("; ") : error instanceof FeeRuleError || error instanceof SchoolAccessError ? error.message : "Could not waive late fees. Check the account before trying again.", success: "" };
  }
  redirect(`/schools/${schoolId}/students/${studentId}`);
}
