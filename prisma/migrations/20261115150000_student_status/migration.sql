CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'WITHDRAWN');
ALTER TABLE "Student" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Student" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "statusReason" TEXT;
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");
ALTER TABLE "Student" ADD CONSTRAINT "Student_status_details" CHECK (
  ("status" = 'ACTIVE' AND "statusChangedAt" IS NULL AND "statusReason" IS NULL)
  OR ("statusChangedAt" IS NOT NULL AND "statusReason" IS NOT NULL)
);
