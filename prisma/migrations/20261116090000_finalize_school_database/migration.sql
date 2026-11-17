BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Student") THEN
    RAISE EXCEPTION 'Student schema migration needs verified DOB and school ownership for existing records. No data was changed. Export/backfill legacy profiles before retrying; do not invent birth dates.';
  END IF;
END $$;
DROP INDEX IF EXISTS "Student_unassigned_admissionNumber_key";
ALTER TABLE "User" RENAME COLUMN "active" TO "isActive";
ALTER TABLE "School" RENAME COLUMN "nextReceipt" TO "receiptSequence";
ALTER TABLE "SchoolMembership" RENAME COLUMN "configureFees" TO "canConfigureFees";
ALTER TABLE "SchoolMembership" RENAME COLUMN "manageAccess" TO "canManageAccess";
ALTER TABLE "FeePlanItem" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "StudentCharge" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "Payment" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "PaymentAllocation" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "Discount" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "DiscountAllocation" RENAME COLUMN "amountCents" TO "amountPaise";
ALTER TABLE "FeePlan" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "Enrollment" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "Payment" RENAME COLUMN "recordedBy" TO "recordedById";
ALTER TABLE "Payment" RENAME COLUMN "reversedBy" TO "reversedById";
ALTER TABLE "Discount" RENAME COLUMN "recordedBy" TO "recordedById";
ALTER TABLE "Discount" RENAME COLUMN "reversedBy" TO "reversedById";
CREATE TEMP TABLE legacy_enrollment_fees ON COMMIT DROP AS SELECT * FROM "Enrollment";
-- CreateEnum
CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('CURRENT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('MOTHER', 'FATHER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER');

-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'GRADUATED';

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_schoolId_feePlanId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "LoginAttempt" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "className",
DROP COLUMN "guardianName",
DROP COLUMN "guardianPhone",
ADD COLUMN     "admissionDate" DATE,
ADD COLUMN     "bloodGroup" "BloodGroup",
ADD COLUMN     "dateOfBirth" DATE NOT NULL,
ADD COLUMN     "gender" "StudentGender",
ADD COLUMN     "photoStoragePath" TEXT,
ALTER COLUMN "schoolId" SET NOT NULL,
ALTER COLUMN "statusChangedAt" SET NOT NULL,
ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "statusChangedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "statusChangedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "email" TEXT,
ADD COLUMN     "logoStoragePath" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "SchoolMembership" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FeeComponent" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FeePlan" ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "FeePlanItem" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "feePlanId",
ADD COLUMN     "endsOn" DATE,
ADD COLUMN     "rollNumber" TEXT,
ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "startsOn" DATE NOT NULL,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "StudentCharge" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "mode" TYPE "PaymentMethod" USING "mode"::"PaymentMethod",
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "reversedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "reversedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Discount" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "reversedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "reversedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "entityType" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- CreateTable
CREATE TABLE "ClassSection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentFeeAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentFeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAddress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentifierType" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdentifierType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIdentifier" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "identifierTypeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStatusHistory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "previousStatus" "StudentStatus",
    "newStatus" "StudentStatus" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassSection_schoolId_academicYearId_classId_name_key" ON "ClassSection"("schoolId", "academicYearId", "classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSection_schoolId_id_academicYearId_classId_key" ON "ClassSection"("schoolId", "id", "academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentFeeAssignment_enrollmentId_key" ON "EnrollmentFeeAssignment"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentFeeAssignment_schoolId_feePlanId_idx" ON "EnrollmentFeeAssignment"("schoolId", "feePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentFeeAssignment_schoolId_enrollmentId_academicYearI_key" ON "EnrollmentFeeAssignment"("schoolId", "enrollmentId", "academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAddress_schoolId_studentId_type_key" ON "StudentAddress"("schoolId", "studentId", "type");

-- CreateIndex
CREATE INDEX "Guardian_schoolId_phone_idx" ON "Guardian"("schoolId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_schoolId_id_key" ON "Guardian"("schoolId", "id");

-- CreateIndex
CREATE INDEX "StudentGuardian_schoolId_guardianId_idx" ON "StudentGuardian"("schoolId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_schoolId_studentId_guardianId_key" ON "StudentGuardian"("schoolId", "studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentifierType_schoolId_code_key" ON "IdentifierType"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "IdentifierType_schoolId_id_key" ON "IdentifierType"("schoolId", "id");

-- CreateIndex
CREATE INDEX "StudentIdentifier_schoolId_identifierTypeId_idx" ON "StudentIdentifier"("schoolId", "identifierTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentIdentifier_schoolId_studentId_identifierTypeId_key" ON "StudentIdentifier"("schoolId", "studentId", "identifierTypeId");

-- CreateIndex
CREATE INDEX "StudentDocument_schoolId_studentId_idx" ON "StudentDocument"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentStatusHistory_schoolId_studentId_effectiveDate_idx" ON "StudentStatusHistory"("schoolId", "studentId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlan_schoolId_id_academicYearId_classId_key" ON "FeePlan"("schoolId", "id", "academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_id_academicYearId_classId_key" ON "Enrollment"("schoolId", "id", "academicYearId", "classId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_sectionId_academicYearId_classId_fkey" FOREIGN KEY ("schoolId", "sectionId", "academicYearId", "classId") REFERENCES "ClassSection"("schoolId", "id", "academicYearId", "classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSection" ADD CONSTRAINT "ClassSection_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolId", "academicYearId") REFERENCES "AcademicYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSection" ADD CONSTRAINT "ClassSection_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "SchoolClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentFeeAssignment" ADD CONSTRAINT "EnrollmentFeeAssignment_schoolId_enrollmentId_academicYear_fkey" FOREIGN KEY ("schoolId", "enrollmentId", "academicYearId", "classId") REFERENCES "Enrollment"("schoolId", "id", "academicYearId", "classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentFeeAssignment" ADD CONSTRAINT "EnrollmentFeeAssignment_schoolId_feePlanId_academicYearId__fkey" FOREIGN KEY ("schoolId", "feePlanId", "academicYearId", "classId") REFERENCES "FeePlan"("schoolId", "id", "academicYearId", "classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAddress" ADD CONSTRAINT "StudentAddress_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_schoolId_guardianId_fkey" FOREIGN KEY ("schoolId", "guardianId") REFERENCES "Guardian"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentifierType" ADD CONSTRAINT "IdentifierType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIdentifier" ADD CONSTRAINT "StudentIdentifier_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIdentifier" ADD CONSTRAINT "StudentIdentifier_schoolId_identifierTypeId_fkey" FOREIGN KEY ("schoolId", "identifierTypeId") REFERENCES "IdentifierType"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "User" SET "updatedAt"="createdAt", "isPlatformAdmin"=true WHERE role='ADMIN' AND NOT EXISTS (SELECT 1 FROM "SchoolMembership" m WHERE m."userId"="User".id);
INSERT INTO "EnrollmentFeeAssignment" (id,"schoolId","enrollmentId","academicYearId","classId","feePlanId","createdById","createdAt")
SELECT 'migrated-'||id,"schoolId",id,"academicYearId","classId","feePlanId","createdById","createdAt" AT TIME ZONE 'UTC' FROM legacy_enrollment_fees;
CREATE UNIQUE INDEX "Enrollment_roll_unique" ON "Enrollment" ("schoolId","academicYearId","classId","sectionId","rollNumber") NULLS NOT DISTINCT WHERE "rollNumber" IS NOT NULL;
CREATE UNIQUE INDEX "StudentGuardian_one_primary" ON "StudentGuardian" ("schoolId","studentId") WHERE "isPrimaryContact";
ALTER TABLE "Student" DROP CONSTRAINT "Student_status_details";
ALTER TABLE "Student" ADD CONSTRAINT "Student_status_details" CHECK (status='ACTIVE' OR ("statusReason" IS NOT NULL AND length(trim("statusReason"))>=3));
ALTER TABLE "Student" ADD CONSTRAINT "Student_dates" CHECK ("dateOfBirth" <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND ("admissionDate" IS NULL OR "admissionDate">="dateOfBirth")), ADD CONSTRAINT "Student_nonblank" CHECK (length(trim(name))>0 AND "admissionNumber"=upper(trim("admissionNumber")) AND length("admissionNumber")>0);
ALTER TABLE "School" ADD CONSTRAINT "School_nonblank" CHECK (length(trim(name))>0 AND code=upper(trim(code)) AND length(code)>0);
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_dates" CHECK ("endsOn" IS NULL OR "endsOn">="startsOn"), ADD CONSTRAINT "Enrollment_roll_nonblank" CHECK ("rollNumber" IS NULL OR (length(trim("rollNumber"))>0 AND "rollNumber"=trim("rollNumber")));
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_positive_size" CHECK ("sizeBytes">0), ADD CONSTRAINT "StudentDocument_private_path" CHECK ("storagePath" LIKE "schoolId" || '/%' AND position('..' IN "storagePath")=0);
ALTER TABLE "StudentAddress" ADD CONSTRAINT "StudentAddress_country" CHECK ("countryCode" ~ '^[A-Z]{2}$');
ALTER TABLE "IdentifierType" ADD CONSTRAINT "IdentifierType_code" CHECK (code=upper(trim(code)) AND length(code)>0);
ALTER TABLE "StudentIdentifier" ADD CONSTRAINT "StudentIdentifier_nonblank" CHECK (length(trim(value))>0);
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_nonblank" CHECK (length(trim(name))>0);
CREATE FUNCTION public.sfm_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
  NEW."updatedAt" := GREATEST(NEW."updatedAt", OLD."updatedAt" + interval '1 millisecond', clock_timestamp()); RETURN NEW;
END $$;
CREATE FUNCTION public.sfm_student_school() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
  IF NEW."schoolId" IS DISTINCT FROM OLD."schoolId" THEN RAISE EXCEPTION 'Student school cannot be reassigned'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER "Student_school_immutable" BEFORE UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION public.sfm_student_school();
CREATE FUNCTION public.sfm_enrollment_dates() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE y "AcademicYear"; BEGIN
  IF TG_OP='UPDATE' AND (NEW."schoolId",NEW."studentId",NEW."academicYearId",NEW."classId",NEW."sectionId") IS DISTINCT FROM (OLD."schoolId",OLD."studentId",OLD."academicYearId",OLD."classId",OLD."sectionId") THEN RAISE EXCEPTION 'Academic placement cannot change within a year'; END IF;
  SELECT * INTO y FROM "AcademicYear" WHERE id=NEW."academicYearId" AND "schoolId"=NEW."schoolId";
  IF NOT FOUND OR NEW."startsOn"<y."startsOn" OR NEW."startsOn">y."endsOn" OR NEW."endsOn">y."endsOn" THEN RAISE EXCEPTION 'Enrollment dates must fall within academic year'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Enrollment_validate" BEFORE INSERT OR UPDATE ON "Enrollment" FOR EACH ROW EXECUTE FUNCTION public.sfm_enrollment_dates();
CREATE FUNCTION public.sfm_charge_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
  IF TG_OP='UPDATE' AND (NEW."schoolId",NEW."enrollmentId",NEW."planItemId",NEW."openingStudentId") IS DISTINCT FROM (OLD."schoolId",OLD."enrollmentId",OLD."planItemId",OLD."openingStudentId") THEN RAISE EXCEPTION 'Charge source is immutable'; END IF;
  IF NEW."enrollmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "EnrollmentFeeAssignment" a JOIN "FeePlanItem" i ON i."schoolId"=a."schoolId" AND i."planId"=a."feePlanId" WHERE a."schoolId"=NEW."schoolId" AND a."enrollmentId"=NEW."enrollmentId" AND i.id=NEW."planItemId") THEN RAISE EXCEPTION 'Charge item must belong to assigned fee plan'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "StudentCharge_source" BEFORE INSERT OR UPDATE ON "StudentCharge" FOR EACH ROW EXECUTE FUNCTION public.sfm_charge_source();
CREATE FUNCTION public.sfm_allocation_student() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE charge_student text; entry_student text; BEGIN
  SELECT COALESCE(e."studentId",c."openingStudentId") INTO charge_student FROM "StudentCharge" c LEFT JOIN "Enrollment" e ON e.id=c."enrollmentId" AND e."schoolId"=c."schoolId" WHERE c.id=NEW."chargeId" AND c."schoolId"=NEW."schoolId";
  IF TG_TABLE_NAME='PaymentAllocation' THEN SELECT "studentId" INTO entry_student FROM "Payment" WHERE id=NEW."paymentId" AND "schoolId"=NEW."schoolId";
  ELSE SELECT "studentId" INTO entry_student FROM "Discount" WHERE id=NEW."discountId" AND "schoolId"=NEW."schoolId"; END IF;
  IF charge_student IS NULL OR entry_student IS DISTINCT FROM charge_student THEN RAISE EXCEPTION 'Allocation must belong to same student'; END IF;
  PERFORM 1 FROM "Student" WHERE id=entry_student AND "schoolId"=NEW."schoolId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER "PaymentAllocation_same_student" BEFORE INSERT OR UPDATE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION public.sfm_allocation_student();
CREATE TRIGGER "DiscountAllocation_same_student" BEFORE INSERT OR UPDATE ON "DiscountAllocation" FOR EACH ROW EXECUTE FUNCTION public.sfm_allocation_student();
CREATE FUNCTION public.sfm_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME; END $$;
CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION public.sfm_append_only();
CREATE TRIGGER "StudentStatusHistory_append_only" BEFORE UPDATE OR DELETE ON "StudentStatusHistory" FOR EACH ROW EXECUTE FUNCTION public.sfm_append_only();
CREATE TRIGGER "User_updatedAt" BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "School_updatedAt" BEFORE UPDATE ON "School" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "Student_updatedAt" BEFORE UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "SchoolMembership_updatedAt" BEFORE UPDATE ON "SchoolMembership" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "AcademicYear_updatedAt" BEFORE UPDATE ON "AcademicYear" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "SchoolClass_updatedAt" BEFORE UPDATE ON "SchoolClass" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "ClassSection_updatedAt" BEFORE UPDATE ON "ClassSection" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "FeeComponent_updatedAt" BEFORE UPDATE ON "FeeComponent" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "FeePlan_updatedAt" BEFORE UPDATE ON "FeePlan" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "FeePlanItem_updatedAt" BEFORE UPDATE ON "FeePlanItem" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "Enrollment_updatedAt" BEFORE UPDATE ON "Enrollment" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "StudentAddress_updatedAt" BEFORE UPDATE ON "StudentAddress" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "Guardian_updatedAt" BEFORE UPDATE ON "Guardian" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "StudentGuardian_updatedAt" BEFORE UPDATE ON "StudentGuardian" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "IdentifierType_updatedAt" BEFORE UPDATE ON "IdentifierType" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
CREATE TRIGGER "StudentIdentifier_updatedAt" BEFORE UPDATE ON "StudentIdentifier" FOR EACH ROW EXECUTE FUNCTION public.sfm_updated_at();
DO $$ DECLARE t text; r text; BEGIN
FOREACH t IN ARRAY ARRAY['User','Session','LoginAttempt','Student','School','SchoolMembership','AcademicYear','SchoolClass','FeeComponent','FeePlan','FeePlanItem','Enrollment','StudentCharge','Payment','PaymentAllocation','Discount','DiscountAllocation','AuditEvent','ClassSection','EnrollmentFeeAssignment','StudentAddress','Guardian','StudentGuardian','IdentifierType','StudentIdentifier','StudentDocument','StudentStatusHistory','_prisma_migrations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',t,r); END IF;
 END LOOP;
END LOOP; END $$;
REVOKE ALL ON FUNCTION public.sfm_updated_at(), public.sfm_student_school(), public.sfm_enrollment_dates(), public.sfm_charge_source(), public.sfm_allocation_student(), public.sfm_append_only() FROM PUBLIC;

-- Financial identity and snapshots survive profile edits; reversals are the only entry updates.
CREATE FUNCTION public.sfm_financial_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['reversedAt','reversedById','reversalReason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reversedAt','reversedById','reversalReason']) OR OLD."reversedAt" IS NOT NULL THEN RAISE EXCEPTION 'Financial entries are immutable; record a reversal instead'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Payment_immutable" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_immutable();
CREATE TRIGGER "Discount_immutable" BEFORE UPDATE OR DELETE ON "Discount" FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_immutable();
CREATE FUNCTION public.sfm_financial_totals() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE sid text; sch text; BEGIN
 IF TG_OP='DELETE' AND TG_TABLE_NAME NOT IN ('PaymentAllocation','DiscountAllocation') THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME IN ('Payment','Discount') THEN sid:=NEW."studentId"; sch:=NEW."schoolId";
 ELSIF TG_TABLE_NAME='StudentCharge' THEN
  SELECT COALESCE(e."studentId",c."openingStudentId"),c."schoolId" INTO sid,sch FROM "StudentCharge" c LEFT JOIN "Enrollment" e ON e.id=c."enrollmentId" AND e."schoolId"=c."schoolId" WHERE c.id=NEW.id;
 ELSE
  SELECT COALESCE(e."studentId",c."openingStudentId"),c."schoolId" INTO sid,sch FROM "StudentCharge" c LEFT JOIN "Enrollment" e ON e.id=c."enrollmentId" AND e."schoolId"=c."schoolId" WHERE c.id=CASE WHEN TG_OP='DELETE' THEN OLD."chargeId" ELSE NEW."chargeId" END;
 END IF;
 IF EXISTS (SELECT 1 FROM "Payment" p WHERE p."schoolId"=sch AND p."studentId"=sid AND p."amountPaise"<>(SELECT COALESCE(sum(a."amountPaise"),0) FROM "PaymentAllocation" a WHERE a."schoolId"=sch AND a."paymentId"=p.id)) OR EXISTS (SELECT 1 FROM "Discount" d WHERE d."schoolId"=sch AND d."studentId"=sid AND d."amountPaise"<>(SELECT COALESCE(sum(a."amountPaise"),0) FROM "DiscountAllocation" a WHERE a."schoolId"=sch AND a."discountId"=d.id)) THEN RAISE EXCEPTION 'Financial allocation total must equal entry amount'; END IF;
 IF EXISTS (SELECT 1 FROM "StudentCharge" c LEFT JOIN "Enrollment" e ON e.id=c."enrollmentId" AND e."schoolId"=c."schoolId" WHERE c."schoolId"=sch AND COALESCE(e."studentId",c."openingStudentId")=sid AND c."amountPaise" <
  (SELECT COALESCE(sum(a."amountPaise"),0) FROM "PaymentAllocation" a JOIN "Payment" p ON p.id=a."paymentId" AND p."schoolId"=a."schoolId" WHERE a."chargeId"=c.id AND a."schoolId"=sch AND p."reversedAt" IS NULL) +
  (SELECT COALESCE(sum(a."amountPaise"),0) FROM "DiscountAllocation" a JOIN "Discount" d ON d.id=a."discountId" AND d."schoolId"=a."schoolId" WHERE a."chargeId"=c.id AND a."schoolId"=sch AND d."reversedAt" IS NULL)) THEN RAISE EXCEPTION 'Allocations exceed charge'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Payment_totals" AFTER INSERT OR UPDATE OR DELETE ON "Payment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_totals();
CREATE CONSTRAINT TRIGGER "Discount_totals" AFTER INSERT OR UPDATE OR DELETE ON "Discount" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_totals();
CREATE CONSTRAINT TRIGGER "PaymentAllocation_totals" AFTER INSERT OR UPDATE OR DELETE ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_totals();
CREATE CONSTRAINT TRIGGER "DiscountAllocation_totals" AFTER INSERT OR UPDATE OR DELETE ON "DiscountAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_totals();
CREATE CONSTRAINT TRIGGER "StudentCharge_totals" AFTER INSERT OR UPDATE OR DELETE ON "StudentCharge" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sfm_financial_totals();
REVOKE ALL ON FUNCTION public.sfm_financial_immutable(),public.sfm_financial_totals() FROM PUBLIC;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Student" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "School" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SchoolMembership" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AcademicYear" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SchoolClass" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FeeComponent" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FeePlan" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FeePlanItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Enrollment" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ClassSection" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StudentAddress" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Guardian" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StudentGuardian" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "IdentifierType" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StudentIdentifier" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD CONSTRAINT "User_normalized_email" CHECK (email=lower(trim(email)) AND length(email)>0);
CREATE FUNCTION public.sfm_year_dates() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."schoolId"=NEW."schoolId" AND e."academicYearId"=NEW.id AND (e."startsOn"<NEW."startsOn" OR e."startsOn">NEW."endsOn" OR e."endsOn">NEW."endsOn")) THEN RAISE EXCEPTION 'Academic year dates would invalidate enrollment history'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AcademicYear_enrollment_dates" BEFORE UPDATE ON "AcademicYear" FOR EACH ROW EXECUTE FUNCTION public.sfm_year_dates();
REVOKE ALL ON FUNCTION public.sfm_year_dates() FROM PUBLIC;
CREATE TRIGGER "PaymentAllocation_append_only" BEFORE UPDATE OR DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION public.sfm_append_only();
CREATE TRIGGER "DiscountAllocation_append_only" BEFORE UPDATE OR DELETE ON "DiscountAllocation" FOR EACH ROW EXECUTE FUNCTION public.sfm_append_only();
COMMIT;
