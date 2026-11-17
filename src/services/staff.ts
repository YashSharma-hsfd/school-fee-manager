import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import type { SessionUser } from "./auth";
import { audit, idSchema, inSchool } from "./fees";
import { FeeRuleError } from "./fee-calculations";
import { SchoolAccessError } from "./school-permissions";

const passwordSchema = z.string().min(12).max(256);
export const newStaffSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGEMENT"]), password: passwordSchema, currentPassword: z.string().min(1).max(256),
});

export async function createStaff(actor: SessionUser, schoolId: string, input: unknown) {
  const data = newStaffSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  return inSchool(actor, schoolId, "access", async tx => {
    const operator = await tx.user.findUnique({ where: { id: actor.id } });
    if (!operator?.isActive || operator.role !== "ADMIN") throw new SchoolAccessError();
    if (!await verifyPassword(data.currentPassword, operator.passwordHash)) throw new FeeRuleError("Your current password is incorrect");
    if (await tx.user.findUnique({ where: { email: data.email } })) throw new FeeRuleError("Account already exists. Use the school-access form to grant membership instead.");
    const user = await tx.user.create({ data: { name: data.name, email: data.email, role: data.role, passwordHash,
      memberships: { create: { schoolId, role: data.role } },
    } });
    await audit(tx, actor, schoolId, "STAFF_ACCOUNT_CREATED", user.id, { name: data.name, email: data.email, role: data.role });
    return user.id;
  });
}

export async function recoverStaffPassword(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ userId: idSchema, password: passwordSchema, currentPassword: z.string().min(1).max(256), reason: z.string().trim().min(3).max(500) }).parse(input);
  const passwordHash = await hashPassword(data.password);
  return inSchool(actor, schoolId, "access", async tx => {
    const operator = await tx.user.findUnique({ where: { id: actor.id } });
    if (!operator?.isActive || operator.role !== "ADMIN") throw new SchoolAccessError();
    if (!await verifyPassword(data.currentPassword, operator.passwordHash)) throw new FeeRuleError("Your current password is incorrect");
    const target = await tx.user.findUnique({ where: { id: data.userId }, include: { memberships: true } });
    if (!target?.isActive || target.role === "ADMIN" || target.id === actor.id || !target.memberships.some(m => m.schoolId === schoolId)) throw new FeeRuleError("Recovery is available only for active non-administrator staff in this school");
    // A password is global: school access alone must not permit taking over another school's staff.
    const managed = await tx.schoolMembership.findMany({ where: { userId: actor.id, role: { not: "MANAGEMENT" }, canManageAccess: true, isActive: true, schoolId: { in: target.memberships.map(m => m.schoolId) } } });
    if (managed.length !== target.memberships.length) throw new FeeRuleError("This account is shared with schools you do not manage. Ask the account administrator to recover it.");
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.loginAttempt.deleteMany({ where: { email: target.email } });
    for (const member of target.memberships) await audit(tx, actor, member.schoolId, "STAFF_PASSWORD_RECOVERED", target.id, { reason: data.reason });
  });
}

export async function revokeStaffAccess(actor: SessionUser, schoolId: string, input: unknown) {
  const userId = idSchema.parse(input);
  return inSchool(actor, schoolId, "access", async tx => {
    if (userId === actor.id) throw new FeeRuleError("You cannot remove your own school access");
    const member = await tx.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId } } });
    if (!member || !member.isActive) return;
    await tx.schoolMembership.update({ where: { schoolId_userId: { schoolId, userId } }, data: { isActive: false } });
    await audit(tx, actor, schoolId, "STAFF_ACCESS_REVOKED", userId, { role: member.role, canConfigureFees: member.canConfigureFees, canManageAccess: member.canManageAccess });
  });
}
