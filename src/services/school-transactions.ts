import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./auth";
import { assertSchoolPermission, type SchoolPermission } from "./school-permissions";

export const idSchema = z.string().min(1).max(128);

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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 3) continue;
      throw error;
    }
  }
}
