ALTER TABLE "StudentCharge" ALTER COLUMN "enrollmentId" DROP NOT NULL;
ALTER TABLE "StudentCharge" ALTER COLUMN "planItemId" DROP NOT NULL;
ALTER TABLE "StudentCharge" ADD COLUMN "openingStudentId" TEXT;
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_schoolId_openingStudentId_fkey"
FOREIGN KEY ("schoolId", "openingStudentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_source_check" CHECK (
  ("openingStudentId" IS NOT NULL AND "enrollmentId" IS NULL AND "planItemId" IS NULL)
  OR ("openingStudentId" IS NULL AND "enrollmentId" IS NOT NULL AND "planItemId" IS NOT NULL)
);
CREATE UNIQUE INDEX "StudentCharge_schoolId_openingStudentId_key" ON "StudentCharge"("schoolId", "openingStudentId");
