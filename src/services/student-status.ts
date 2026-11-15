import { z } from "zod";
import type { SessionUser } from "./auth";
import { audit, idSchema, inSchool } from "./fees";
import { FeeRuleError } from "./fee-calculations";

export const studentStatusSchema = z.enum(["ACTIVE", "INACTIVE", "WITHDRAWN"]);
export const studentFilterSchema = z.enum(["ACTIVE", "INACTIVE", "WITHDRAWN", "ALL"]).catch("ACTIVE");
export const statusLabels = { ACTIVE: "Active", INACTIVE: "Inactive", WITHDRAWN: "Withdrawn" } as const;

export async function changeStudentStatus(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ studentId: idSchema, status: studentStatusSchema,
    reason: z.string().trim().min(3).max(500), expectedUpdatedAt: z.iso.datetime(),
  }).parse(input);
  return inSchool(actor, schoolId, "students", async tx => {
    const student = await tx.student.findFirst({ where: { schoolId, id: data.studentId } });
    if (!student) throw new FeeRuleError("Student not found in this school");
    if (student.status === data.status) return student;
    if (student.updatedAt.toISOString() !== data.expectedUpdatedAt) throw new FeeRuleError("Student changed. Reload the account before changing status.");
    const changedAt = new Date(Math.max(Date.now(), student.updatedAt.getTime() + 1));
    const updated = await tx.student.update({ where: { id: student.id }, data: {
      status: data.status, statusReason: data.reason, statusChangedAt: changedAt, updatedAt: changedAt,
    } });
    await audit(tx, actor, schoolId, "STUDENT_STATUS_CHANGED", student.id, {
      before: student.status, after: data.status, reason: data.reason, changedAt: changedAt.toISOString(),
    });
    return updated;
  });
}
