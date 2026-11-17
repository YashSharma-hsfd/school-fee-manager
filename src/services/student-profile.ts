import { Prisma } from "@prisma/client";
import type { StudentInput } from "@/validators/student";
import { FeeRuleError } from "./fee-calculations";

// Class and contact labels are projections, never duplicate Student columns.
export const studentProfileInclude = {
  enrollments: { orderBy: { academicYear: { startsOn: "desc" } }, take: 1, include: { schoolClass: true, feeAssignment: true } },
  guardians: { orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }], include: { guardian: true } },
} satisfies Prisma.StudentInclude;
type Profile = Prisma.StudentGetPayload<{ include: typeof studentProfileInclude }>;
export function studentProfile<T extends Profile>(student: T) {
  return { ...student, className: student.enrollments[0]?.schoolClass.name ?? "Not enrolled",
    guardianName: student.guardians.find(link => link.isPrimaryContact)?.guardian.name ?? "", guardianPhone: student.guardians.find(link => link.isPrimaryContact)?.guardian.phone ?? "" };
}

export function studentRecord(input: StudentInput) {
  if (input.admissionDate && input.admissionDate < input.dateOfBirth) throw new FeeRuleError("Admission date cannot precede date of birth");
  if (input.guardianPhone && !input.guardianName) throw new FeeRuleError("Provide the guardian name with a contact number");
  return { name: input.name, admissionNumber: input.admissionNumber, dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
    admissionDate: input.admissionDate ? new Date(`${input.admissionDate}T00:00:00Z`) : null };
}

export async function savePrimaryGuardian(tx: Prisma.TransactionClient, schoolId: string, studentId: string, input: StudentInput) {
  const link = await tx.studentGuardian.findFirst({ where: { schoolId, studentId, isPrimaryContact: true } });
  if (!input.guardianName) {
    if (link) await tx.studentGuardian.update({ where: { id: link.id }, data: { isPrimaryContact: false } });
    return;
  }
  const data = { name: input.guardianName, phone: input.guardianPhone || null };
  if (link) await tx.guardian.update({ where: { schoolId_id: { schoolId, id: link.guardianId } }, data });
  else {
    const guardian = await tx.guardian.create({ data: { schoolId, ...data } });
    await tx.studentGuardian.create({ data: { schoolId, studentId, guardianId: guardian.id, relationship: "OTHER", isPrimaryContact: true } });
  }
}
