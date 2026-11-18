import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./auth";
import { assertSchoolPermission, type SchoolPermission } from "./school-permissions";

export const idSchema = z.string().min(1).max(128);
const maxTransactionAttempts = 5;
const retryableSqlStates = new Set(["40001", "40P01"]);

export function isTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034" || (error.code === "P2010" && typeof error.meta?.code === "string" && retryableSqlStates.has(error.meta.code));
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // The Rust connector sometimes embeds the PostgreSQL error instead of returning P2034.
    // Read only its first SQLSTATE; constraint failures and arbitrary message text are not retryable.
    const state = error.message.match(/\bPostgresError\s*\{\s*code:\s*["']([A-Z0-9]{5})["']/)?.[1];
    return !!state && retryableSqlStates.has(state);
  }
  return false;
}

// Shared boundary keeps optional fee modules independent of the services they extend.
export async function inSchool<T>(actor: SessionUser, schoolId: string, permission: SchoolPermission, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  idSchema.parse(schoolId);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const member = await tx.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId: actor.id } } });
        assertSchoolPermission(member, permission);
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
    } catch (error) {
      if (!isTransactionConflict(error) || attempt >= maxTransactionAttempts - 1) throw error;
      // Back off before opening a new transaction so concurrent requests do not collide in lockstep.
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt + Math.floor(Math.random() * 25)));
    }
  }
}
