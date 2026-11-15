import { z } from "zod";
import type { SessionUser } from "./auth";
import { audit, enrollInTransaction, idSchema, inSchool } from "./fees";
import { FeeRuleError } from "./fee-calculations";

export const promotionSchema = z.object({ sourceYearId: idSchema, sourceClassId: idSchema,
  academicYearId: idSchema, classId: idSchema, studentIds: z.array(idSchema).min(1).max(100),
}).refine(data => new Set(data.studentIds).size === data.studentIds.length, "Duplicate student selection");

export async function bulkPromote(actor: SessionUser, schoolId: string, input: unknown) {
  const data = promotionSchema.parse(input);
  return inSchool(actor, schoolId, "students", async tx => {
    const source = await tx.academicYear.findFirst({ where: { schoolId, id: data.sourceYearId } });
    const target = await tx.academicYear.findFirst({ where: { schoolId, id: data.academicYearId } });
    if (!source || !target || target.startsOn <= source.endsOn) throw new FeeRuleError("Choose a later academic year in this school");
    const plan = await tx.feePlan.findFirst({ where: { schoolId, academicYearId: target.id, classId: data.classId } });
    if (!plan) throw new FeeRuleError("Configure the destination class fee plan first");
    const members = await tx.enrollment.findMany({ where: { schoolId, academicYearId: source.id, classId: data.sourceClassId, studentId: { in: data.studentIds } } });
    if (members.length !== data.studentIds.length) throw new FeeRuleError("One or more selected students do not belong to the source class/year");
    const later = await tx.enrollment.findFirst({ where: { schoolId, studentId: { in: data.studentIds }, academicYear: { startsOn: { gt: target.startsOn } } } });
    if (later) throw new FeeRuleError("A selected student is already enrolled beyond the destination year");
    for (const studentId of data.studentIds) await enrollInTransaction(tx, actor, schoolId, { studentId, academicYearId: target.id, classId: data.classId });
    await audit(tx, actor, schoolId, "BULK_PROMOTION_COMPLETED", target.id, { sourceYearId: source.id, sourceClassId: data.sourceClassId, classId: data.classId, studentIds: data.studentIds });
    return data.studentIds.length;
  });
}
