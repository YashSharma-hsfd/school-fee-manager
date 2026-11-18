BEGIN;
CREATE TABLE "LateFeePolicy" (
  id TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "feePlanId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL CHECK ("amountPaise" BETWEEN 0 AND 1000000000),
  "intervalMonths" INTEGER NOT NULL CHECK ("intervalMonths" IN (1,3,12)),
  "effectiveFrom" DATE NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "LateFeePolicy_schoolId_feePlanId_fkey" FOREIGN KEY ("schoolId","feePlanId") REFERENCES "FeePlan"("schoolId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LateFeePolicy_schoolId_feePlanId_effectiveFrom_createdAt_idx" ON "LateFeePolicy"("schoolId","feePlanId","effectiveFrom","createdAt");
CREATE TRIGGER "LateFeePolicy_append_only" BEFORE UPDATE OR DELETE ON "LateFeePolicy" FOR EACH ROW EXECUTE FUNCTION public.sfm_append_only();
ALTER TABLE "LateFeePolicy" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE public."LateFeePolicy" FROM %I',r); END IF;
  END LOOP;
END $$;

ALTER TABLE "StudentCharge" ADD COLUMN "lateFeeForDueOn" DATE, ADD COLUMN "lateFeeCycleOn" DATE;
CREATE UNIQUE INDEX "StudentCharge_late_fee_cycle_unique" ON "StudentCharge"("schoolId","enrollmentId","lateFeeForDueOn","lateFeeCycleOn");
ALTER TABLE "StudentCharge" DROP CONSTRAINT "StudentCharge_source_check";
ALTER TABLE "StudentCharge" ADD CONSTRAINT "StudentCharge_source_check" CHECK (
  ("lateFeeForDueOn" IS NULL AND "lateFeeCycleOn" IS NULL AND
    (("openingStudentId" IS NOT NULL AND "enrollmentId" IS NULL AND "planItemId" IS NULL) OR
     ("openingStudentId" IS NULL AND "enrollmentId" IS NOT NULL AND "planItemId" IS NOT NULL)))
  OR ("lateFeeForDueOn" IS NOT NULL AND "lateFeeCycleOn" IS NOT NULL AND "openingStudentId" IS NULL AND "enrollmentId" IS NOT NULL AND "planItemId" IS NULL AND "lateFeeCycleOn">="lateFeeForDueOn")
);
CREATE OR REPLACE FUNCTION public.sfm_charge_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
  IF TG_OP='UPDATE' AND (NEW."schoolId",NEW."enrollmentId",NEW."planItemId",NEW."openingStudentId",NEW."lateFeeForDueOn",NEW."lateFeeCycleOn") IS DISTINCT FROM (OLD."schoolId",OLD."enrollmentId",OLD."planItemId",OLD."openingStudentId",OLD."lateFeeForDueOn",OLD."lateFeeCycleOn") THEN RAISE EXCEPTION 'Charge source is immutable'; END IF;
  IF NEW."enrollmentId" IS NOT NULL THEN
    IF NEW."lateFeeForDueOn" IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM "EnrollmentFeeAssignment" a JOIN "LateFeePolicy" p ON p."schoolId"=a."schoolId" AND p."feePlanId"=a."feePlanId" WHERE a."schoolId"=NEW."schoolId" AND a."enrollmentId"=NEW."enrollmentId") THEN RAISE EXCEPTION 'Late fee requires a configured enrollment fee plan'; END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM "EnrollmentFeeAssignment" a JOIN "FeePlanItem" i ON i."schoolId"=a."schoolId" AND i."planId"=a."feePlanId" WHERE a."schoolId"=NEW."schoolId" AND a."enrollmentId"=NEW."enrollmentId" AND i.id=NEW."planItemId") THEN RAISE EXCEPTION 'Charge item must belong to assigned fee plan'; END IF;
  END IF;
  RETURN NEW;
END $$;
COMMIT;
