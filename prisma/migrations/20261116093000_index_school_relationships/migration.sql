BEGIN;
SET LOCAL lock_timeout = '10s';
-- DropIndex
DROP INDEX "EnrollmentFeeAssignment_schoolId_feePlanId_idx";

-- CreateIndex
CREATE INDEX "FeePlan_schoolId_classId_idx" ON "FeePlan"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "FeePlanItem_schoolId_componentId_idx" ON "FeePlanItem"("schoolId", "componentId");

-- CreateIndex
CREATE INDEX "Enrollment_schoolId_classId_idx" ON "Enrollment"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Enrollment_schoolId_sectionId_academicYearId_classId_idx" ON "Enrollment"("schoolId", "sectionId", "academicYearId", "classId");

-- CreateIndex
CREATE INDEX "StudentCharge_schoolId_planItemId_idx" ON "StudentCharge"("schoolId", "planItemId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_studentId_idx" ON "Payment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_schoolId_chargeId_idx" ON "PaymentAllocation"("schoolId", "chargeId");

-- CreateIndex
CREATE INDEX "Discount_schoolId_studentId_idx" ON "Discount"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "DiscountAllocation_schoolId_chargeId_idx" ON "DiscountAllocation"("schoolId", "chargeId");

-- CreateIndex
CREATE INDEX "ClassSection_schoolId_classId_idx" ON "ClassSection"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "EnrollmentFeeAssignment_schoolId_feePlanId_academicYearId_c_idx" ON "EnrollmentFeeAssignment"("schoolId", "feePlanId", "academicYearId", "classId");

COMMIT;
