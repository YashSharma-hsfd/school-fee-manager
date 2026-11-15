import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const auditFiltersSchema = z.object({
  actor: z.string().trim().max(120).catch(""), action: z.string().trim().max(80).regex(/^[A-Z_]*$/).catch(""),
  entity: z.string().trim().max(128).catch(""),
  auditFrom: z.union([z.iso.date(), z.literal("")]).catch(""), auditTo: z.union([z.iso.date(), z.literal("")]).catch(""),
}).refine(data => !data.auditFrom || !data.auditTo || data.auditFrom <= data.auditTo, "Audit start must not follow end date");

export function auditWhere(schoolId: string, input: unknown): Prisma.AuditEventWhereInput {
  const data = auditFiltersSchema.parse(input);
  const end = data.auditTo ? new Date(`${data.auditTo}T00:00:00+05:30`) : null;
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  return { schoolId,
    ...(data.actor ? { actorName: { contains: data.actor, mode: "insensitive" } } : {}),
    ...(data.action ? { action: data.action } : {}), ...(data.entity ? { entityId: data.entity } : {}),
    createdAt: { ...(data.auditFrom ? { gte: new Date(`${data.auditFrom}T00:00:00+05:30`) } : {}), ...(end ? { lt: end } : {}) },
  };
}
