import type { PrismaClient } from "@prisma/client";
// Only for uniquely named fixtures in a disposable test database.
export async function cleanupSchool(prisma: PrismaClient, schoolId: string) {
  await prisma.$transaction(async tx => {
    const where = { schoolId };
    await tx.paymentAllocation.deleteMany({ where });
    await tx.discountAllocation.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.discount.deleteMany({ where });
    await tx.studentCharge.deleteMany({ where });
    await tx.enrollment.deleteMany({ where });
    await tx.feePlanItem.deleteMany({ where });
    await tx.feePlan.deleteMany({ where });
    await tx.feeComponent.deleteMany({ where });
    await tx.student.deleteMany({ where });
    await tx.schoolClass.deleteMany({ where });
    await tx.academicYear.deleteMany({ where });
    await tx.auditEvent.deleteMany({ where });
    await tx.schoolMembership.deleteMany({ where });
    await tx.school.delete({ where: { id: schoolId } });
  });
}
