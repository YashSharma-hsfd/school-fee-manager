import type { PrismaClient } from "@prisma/client";
// Only for uniquely named fixtures in a disposable test database.
export async function cleanupSchool(prisma: PrismaClient, schoolId: string) {
  await prisma.$transaction(async tx => {
    const [{ name }] = await tx.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    if (!/^school_fee_test_[a-f0-9]{16}$/.test(name)) throw new Error("Fixture cleanup requires the disposable test database");
    await tx.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "StudentStatusHistory" DISABLE TRIGGER "StudentStatusHistory_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "Payment" DISABLE TRIGGER "Payment_immutable"');
    await tx.$executeRawUnsafe('ALTER TABLE "Discount" DISABLE TRIGGER "Discount_immutable"');
    await tx.$executeRawUnsafe('ALTER TABLE "PaymentAllocation" DISABLE TRIGGER "PaymentAllocation_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "DiscountAllocation" DISABLE TRIGGER "DiscountAllocation_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "LateFeePolicy" DISABLE TRIGGER "LateFeePolicy_append_only"');
    const where = { schoolId };
    await tx.paymentAllocation.deleteMany({ where });
    await tx.discountAllocation.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.discount.deleteMany({ where });
    await tx.studentCharge.deleteMany({ where });
    await tx.enrollmentFeeAssignment.deleteMany({ where });
    await tx.enrollment.deleteMany({ where });
    await tx.feePlanItem.deleteMany({ where });
    await tx.lateFeePolicy.deleteMany({ where });
    await tx.feePlan.deleteMany({ where });
    await tx.feeComponent.deleteMany({ where });
    await tx.studentStatusHistory.deleteMany({ where });
    await tx.studentDocument.deleteMany({ where });
    await tx.studentIdentifier.deleteMany({ where });
    await tx.identifierType.deleteMany({ where });
    await tx.studentAddress.deleteMany({ where });
    await tx.studentGuardian.deleteMany({ where });
    await tx.guardian.deleteMany({ where });
    await tx.classSection.deleteMany({ where });
    await tx.student.deleteMany({ where });
    await tx.schoolClass.deleteMany({ where });
    await tx.academicYear.deleteMany({ where });
    await tx.auditEvent.deleteMany({ where });
    await tx.schoolMembership.deleteMany({ where });
    await tx.school.delete({ where: { id: schoolId } });
    // Flush deferred checks before restoring triggers after disposable-fixture deletion.
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await tx.$executeRawUnsafe('ALTER TABLE "PaymentAllocation" ENABLE TRIGGER "PaymentAllocation_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "DiscountAllocation" ENABLE TRIGGER "DiscountAllocation_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "Payment" ENABLE TRIGGER "Payment_immutable"');
    await tx.$executeRawUnsafe('ALTER TABLE "Discount" ENABLE TRIGGER "Discount_immutable"');
    await tx.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "StudentStatusHistory" ENABLE TRIGGER "StudentStatusHistory_append_only"');
    await tx.$executeRawUnsafe('ALTER TABLE "LateFeePolicy" ENABLE TRIGGER "LateFeePolicy_append_only"');
  });
}
