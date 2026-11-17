"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession, sessionCookie } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { audit } from "@/services/fees";
import { FeeRuleError } from "@/services/fee-calculations";
import type { SchoolFormState } from "./schools";

export async function changeOwnPassword(_state: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const actor = await readSession();
  if (!actor) redirect("/login");
  try {
    const data = z.object({ currentPassword: z.string().min(1).max(256), password: z.string().min(12).max(256), confirmation: z.string().max(256) })
      .refine(value => value.password === value.confirmation, "New passwords must match")
      .refine(value => value.password !== value.currentPassword, "Choose a different new password").parse(Object.fromEntries(formData));
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.isActive || !await verifyPassword(data.currentPassword, user.passwordHash)) throw new FeeRuleError("Your current password is incorrect");
    const passwordHash = await hashPassword(data.password);
    await prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({ where: { id: actor.id, isActive: true, passwordHash: user.passwordHash }, data: { passwordHash } });
      if (updated.count !== 1) throw new FeeRuleError("Account changed. Sign in again before retrying.");
      await tx.session.deleteMany({ where: { userId: actor.id } });
      const memberships = await tx.schoolMembership.findMany({ where: { userId: actor.id } });
      for (const member of memberships) await audit(tx, actor, member.schoolId, "PASSWORD_CHANGED", actor.id, {});
    });
  } catch (error) {
    return { success: "", error: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join("; ") : error instanceof FeeRuleError ? error.message : "Could not update password. Try again later." };
  }
  (await cookies()).delete(sessionCookie);
  redirect("/login");
}
