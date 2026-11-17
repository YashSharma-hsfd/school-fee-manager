import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords.ts";
import { z } from "zod";

// Local system-owner recovery only. No public endpoint can reset administrator accounts.
const parsed = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(256),
  reason: z.string().trim().min(3).max(500),
}).safeParse({ email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD, reason: process.env.STAFF_RESET_REASON });

if (!parsed.success) {
  console.error("Set STAFF_EMAIL, STAFF_PASSWORD (12-256 characters), and STAFF_RESET_REASON. Run only as the system owner for a verified staff member.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { email: parsed.data.email }, include: { memberships: true } });
      if (!user?.isActive) throw new Error("Active account not found");
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.loginAttempt.deleteMany({ where: { email: user.email } });
      for (const member of user.memberships) await tx.auditEvent.create({ data: {
        schoolId: member.schoolId, actorId: "system-owner-cli", actorName: "System owner (local recovery)",
        action: "STAFF_PASSWORD_RECOVERED", entityId: user.id, details: { reason: parsed.data.reason, method: "LOCAL_OWNER_RECOVERY" },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    console.log("Staff password reset. All existing sessions revoked. Clear the password variable from your shell.");
  } catch {
    console.error("Could not reset password. Check the active account, database connectivity, migrations and retry if a concurrent change occurred.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
