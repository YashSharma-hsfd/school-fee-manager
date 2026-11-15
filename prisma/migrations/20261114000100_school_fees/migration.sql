-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGEMENT';

-- DropIndex
DROP INDEX "Student_admissionNumber_key";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nextReceipt" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "configureFees" BOOLEAN NOT NULL DEFAULT false,
    "manageAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("schoolId","userId")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlanItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "installment" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueOn" DATE NOT NULL,

    CONSTRAINT "FeePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCharge" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "reference" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentAdmissionNumber" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountAllocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "DiscountAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE INDEX "SchoolMembership_userId_idx" ON "SchoolMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_schoolId_name_key" ON "AcademicYear"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_schoolId_id_key" ON "AcademicYear"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_id_key" ON "SchoolClass"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FeeComponent_schoolId_name_key" ON "FeeComponent"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FeeComponent_schoolId_id_key" ON "FeeComponent"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlan_schoolId_academicYearId_classId_key" ON "FeePlan"("schoolId", "academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlan_schoolId_id_key" ON "FeePlan"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlanItem_schoolId_planId_componentId_installment_key" ON "FeePlanItem"("schoolId", "planId", "componentId", "installment");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlanItem_schoolId_id_key" ON "FeePlanItem"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_studentId_academicYearId_key" ON "Enrollment"("schoolId", "studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_id_key" ON "Enrollment"("schoolId", "id");

-- CreateIndex
CREATE INDEX "StudentCharge_schoolId_dueOn_idx" ON "StudentCharge"("schoolId", "dueOn");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCharge_schoolId_enrollmentId_planItemId_key" ON "StudentCharge"("schoolId", "enrollmentId", "planItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCharge_schoolId_id_key" ON "StudentCharge"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paidOn_idx" ON "Payment"("schoolId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_requestKey_key" ON "Payment"("schoolId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_receiptNumber_key" ON "Payment"("schoolId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_id_key" ON "Payment"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_schoolId_paymentId_chargeId_key" ON "PaymentAllocation"("schoolId", "paymentId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_schoolId_requestKey_key" ON "Discount"("schoolId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_schoolId_id_key" ON "Discount"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountAllocation_schoolId_discountId_chargeId_key" ON "DiscountAllocation"("schoolId", "discountId", "chargeId");

-- CreateIndex
CREATE INDEX "AuditEvent_schoolId_createdAt_idx" ON "AuditEvent"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_id_key" ON "Student"("schoolId", "id");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolId", "academicYearId") REFERENCES "AcademicYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_schoolId_planId_fkey" FOREIGN KEY ("schoolId", "planId") REFERENCES "FeePlan"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_schoolId_componentId_fkey" FOREIGN KEY ("schoolId", "componentId") REFERENCES "FeeComponent"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolId", "academicYearId") REFERENCES "AcademicYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_feePlanId_fkey" FOREIGN KEY ("schoolId", "feePlanId") REFERENCES "FeePlan"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_schoolId_planItemId_fkey" FOREIGN KEY ("schoolId", "planItemId") REFERENCES "FeePlanItem"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_schoolId_paymentId_fkey" FOREIGN KEY ("schoolId", "paymentId") REFERENCES "Payment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_schoolId_chargeId_fkey" FOREIGN KEY ("schoolId", "chargeId") REFERENCES "StudentCharge"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountAllocation" ADD CONSTRAINT "DiscountAllocation_schoolId_discountId_fkey" FOREIGN KEY ("schoolId", "discountId") REFERENCES "Discount"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountAllocation" ADD CONSTRAINT "DiscountAllocation_schoolId_chargeId_fkey" FOREIGN KEY ("schoolId", "chargeId") REFERENCES "StudentCharge"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Protect money and date invariants even if a write bypasses application validation.
CREATE UNIQUE INDEX "Student_unassigned_admissionNumber_key" ON "Student"("admissionNumber") WHERE "schoolId" IS NULL;
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_date_range" CHECK ("endsOn" > "startsOn");
ALTER TABLE "School" ADD CONSTRAINT "School_receipt_sequence" CHECK ("nextReceipt" >= 0);
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_positive_amount" CHECK ("amountCents" > 0), ADD CONSTRAINT "FeePlanItem_installment_range" CHECK ("installment" BETWEEN 1 AND 12);
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK ("amountCents" > 0), ADD CONSTRAINT "Payment_reversal_details" CHECK (("reversedAt" IS NULL AND "reversedBy" IS NULL AND "reversalReason" IS NULL) OR ("reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND "reversalReason" IS NOT NULL));
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "DiscountAllocation" ADD CONSTRAINT "DiscountAllocation_positive_amount" CHECK ("amountCents" > 0);
