import { z } from "zod";
import type { SessionUser } from "./auth";
import { assignEnrollmentFees, enrollInTransaction, enrollmentSchema, idSchema, inSchool } from "./fees";
import { FeeRuleError } from "./fee-calculations";

export const bulkEnrollmentSchema = enrollmentSchema.omit({ studentId: true, rollNumber: true }).extend({
  students: z.array(z.object({ studentId: idSchema, rollNumber: z.string().trim().max(40).optional() })).min(1).max(100),
}).refine(data => new Set(data.students.map(student => student.studentId)).size === data.students.length, "Duplicate student selection")
  .refine(data => { const rolls = data.students.flatMap(student => student.rollNumber ? [student.rollNumber] : []); return new Set(rolls).size === rolls.length; }, "Duplicate roll number in selection");

export async function bulkEnroll(actor: SessionUser, schoolId: string, input: unknown) {
  const data = bulkEnrollmentSchema.parse(input);
  return inSchool(actor, schoolId, "enroll", async tx => {
    for (const student of data.students) await enrollInTransaction(tx, actor, schoolId, { ...data, ...student });
    return data.students.length;
  });
}

export const feeAssignmentSchema = z.object({ enrollmentIds: z.array(idSchema).min(1).max(100) })
  .refine(data => new Set(data.enrollmentIds).size === data.enrollmentIds.length, "Duplicate enrollment selection");

export async function assignStudentFees(actor: SessionUser, schoolId: string, input: unknown) {
  const { enrollmentIds } = feeAssignmentSchema.parse(input);
  return inSchool(actor, schoolId, "assignFees", async tx => {
    const enrollments = await tx.enrollment.findMany({ where: { schoolId, id: { in: enrollmentIds } }, include: { feeAssignment: true } });
    if (enrollments.length !== enrollmentIds.length) throw new FeeRuleError("Select enrollment records belonging to this school.");
    // Check every plan before writing anything. A repeat leaves existing assignments intact.
    for (const enrollment of enrollments.filter(item => !item.feeAssignment)) {
      const plan = await tx.feePlan.findUnique({ where: { schoolId_academicYearId_classId: { schoolId, academicYearId: enrollment.academicYearId, classId: enrollment.classId } }, include: { items: true } });
      if (!plan?.items.length) throw new FeeRuleError("A selected enrollment has no configured class fee plan. Ask the fee configurator to create it first. No fees were assigned.");
    }
    for (const enrollment of enrollments) await assignEnrollmentFees(tx, actor, schoolId, enrollment);
    return { assigned: enrollments.filter(item => !item.feeAssignment).length, unchanged: enrollments.filter(item => item.feeAssignment).length };
  });
}
