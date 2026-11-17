-- Synthetic database regression checks. Always rolls back; never leaves fixture data.
BEGIN;
DO $$
DECLARE rejected boolean; checks integer := 0;
BEGIN
  INSERT INTO "School" (id,name,code,"updatedAt") VALUES ('schema-test-a','Synthetic schema A','SCHEMATEST_A',now()),('schema-test-b','Synthetic schema B','SCHEMATEST_B',now());
  INSERT INTO "Student" (id,"schoolId","admissionNumber",name,"dateOfBirth","updatedAt") VALUES
    ('schema-test-student-a','schema-test-a','0001','Synthetic student A','2010-05-10',now()),
    ('schema-test-student-b','schema-test-b','0001','Synthetic student B','2010-05-10',now()),
    ('schema-test-student-c','schema-test-a','0002','Synthetic student C','2010-05-10',now());
  checks := checks+1; -- Same admission number in separate schools is valid.
  rejected:=false; BEGIN
    INSERT INTO "Student" (id,"schoolId","admissionNumber",name,"dateOfBirth","updatedAt") VALUES ('schema-test-dup','schema-test-a','0001','Duplicate','2010-05-10',now());
  EXCEPTION WHEN unique_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate admission accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "Student" (id,"admissionNumber",name,"dateOfBirth","updatedAt") VALUES ('schema-test-null-school','1','No school','2010-05-10',now());
  EXCEPTION WHEN not_null_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Missing school accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "Student" (id,"schoolId","admissionNumber",name,"updatedAt") VALUES ('schema-test-null-dob','schema-test-a','3','No DOB',now());
  EXCEPTION WHEN not_null_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Missing DOB accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN UPDATE "Student" SET "schoolId"='schema-test-b' WHERE id='schema-test-student-a'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Student school reassignment accepted'; END IF; checks:=checks+1;
  INSERT INTO "Guardian" (id,"schoolId",name,phone,"updatedAt") VALUES ('schema-test-guardian-a','schema-test-a','Synthetic mother','0123456789',now()),('schema-test-guardian-b','schema-test-b','Synthetic father','0123456789',now()),('schema-test-guardian-c','schema-test-a','Synthetic father A','0123456789',now());
  INSERT INTO "StudentGuardian" (id,"schoolId","studentId","guardianId",relationship,"isPrimaryContact","updatedAt") VALUES ('schema-test-link-a','schema-test-a','schema-test-student-a','schema-test-guardian-a','MOTHER',true,now());
  rejected:=false; BEGIN
    INSERT INTO "StudentGuardian" (id,"schoolId","studentId","guardianId",relationship,"updatedAt") VALUES ('schema-test-link-b','schema-test-a','schema-test-student-a','schema-test-guardian-b','FATHER',now());
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Cross-school guardian accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "StudentGuardian" (id,"schoolId","studentId","guardianId",relationship,"isPrimaryContact","updatedAt") VALUES ('schema-test-primary-dup','schema-test-a','schema-test-student-a','schema-test-guardian-c','OTHER',true,now());
  EXCEPTION WHEN unique_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate primary contact accepted'; END IF; checks:=checks+1;
  INSERT INTO "AcademicYear" (id,"schoolId",name,"startsOn","endsOn","updatedAt") VALUES ('schema-test-year','schema-test-a','Synthetic year','2026-04-01','2027-03-31',now()),('schema-test-year-next','schema-test-a','Synthetic next year','2027-04-01','2028-03-31',now());
  INSERT INTO "SchoolClass" (id,"schoolId",name,"updatedAt") VALUES ('schema-test-class','schema-test-a','Class 5',now()),('schema-test-class-next','schema-test-a','Class 6',now());
  INSERT INTO "ClassSection" (id,"schoolId","academicYearId","classId",name,"updatedAt") VALUES ('schema-test-section','schema-test-a','schema-test-year','schema-test-class','A',now());
  INSERT INTO "Enrollment" (id,"schoolId","studentId","academicYearId","classId","startsOn","rollNumber","createdById","updatedAt") VALUES ('schema-test-enrollment-a','schema-test-a','schema-test-student-a','schema-test-year','schema-test-class','2026-04-01','01','synthetic-actor',now());
  checks:=checks+1; -- Enrollment without fees is valid and visibly unconfigured.
  rejected:=false; BEGIN
    INSERT INTO "Enrollment" (id,"schoolId","studentId","academicYearId","classId","startsOn","rollNumber","createdById","updatedAt") VALUES ('schema-test-roll-dup','schema-test-a','schema-test-student-c','schema-test-year','schema-test-class','2026-04-01','01','synthetic-actor',now());
  EXCEPTION WHEN unique_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate sectionless roll accepted'; END IF; checks:=checks+1;
  INSERT INTO "Enrollment" (id,"schoolId","studentId","academicYearId","classId","startsOn","rollNumber","createdById","updatedAt") VALUES ('schema-test-enrollment-next','schema-test-a','schema-test-student-a','schema-test-year-next','schema-test-class-next','2027-04-01','09','synthetic-actor',now());
  checks:=checks+1; -- Roll number changes in a later year are valid.
  rejected:=false; BEGIN
    INSERT INTO "Enrollment" (id,"schoolId","studentId","academicYearId","classId","sectionId","startsOn","createdById","updatedAt") VALUES ('schema-test-section-mismatch','schema-test-a','schema-test-student-c','schema-test-year-next','schema-test-class-next','schema-test-section','2027-04-01','synthetic-actor',now());
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Mismatched section/year/class accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN UPDATE "Enrollment" SET "classId"='schema-test-class-next' WHERE id='schema-test-enrollment-a'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Midyear placement change accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN UPDATE "Enrollment" SET "startsOn"='2025-01-01' WHERE id='schema-test-enrollment-a'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Enrollment outside year accepted'; END IF; checks:=checks+1;
  INSERT INTO "StudentCharge" (id,"schoolId","openingStudentId",label,"amountPaise","dueOn") VALUES ('schema-test-charge-a','schema-test-a','schema-test-student-a','Synthetic opening due',10000,'2026-04-01'),('schema-test-charge-c','schema-test-a','schema-test-student-c','Other student due',10000,'2026-04-01');
  INSERT INTO "Payment" (id,"schoolId","studentId","amountPaise","paidOn",mode,"receiptNumber","requestKey","requestHash","recordedById","recordedByName","studentName","studentAdmissionNumber","schoolName") VALUES ('schema-test-payment','schema-test-a','schema-test-student-a',1000,'2026-05-01','CASH','SYNTHETIC-1','synthetic-key','synthetic-hash','synthetic-actor','Synthetic actor','Synthetic A','0001','Synthetic school');
  rejected:=false; BEGIN INSERT INTO "PaymentAllocation" (id,"schoolId","paymentId","chargeId","amountPaise") VALUES ('schema-test-bad-allocation','schema-test-a','schema-test-payment','schema-test-charge-c',1000); EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Other student allocation accepted'; END IF; checks:=checks+1;
  INSERT INTO "PaymentAllocation" (id,"schoolId","paymentId","chargeId","amountPaise") VALUES ('schema-test-allocation','schema-test-a','schema-test-payment','schema-test-charge-a',1000);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  checks:=checks+1; -- A complete payment passes deferred total checks.
  rejected:=false; BEGIN UPDATE "Payment" SET "amountPaise"=2000 WHERE id='schema-test-payment'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Payment amount rewrite accepted'; END IF; checks:=checks+1;
  INSERT INTO "AuditEvent" (id,"schoolId","actorId","actorName",action,"entityType","entityId",details) VALUES ('schema-test-audit','schema-test-a','synthetic-actor','Synthetic actor','TEST','Student','schema-test-student-a','{}');
  rejected:=false; BEGIN DELETE FROM "AuditEvent" WHERE id='schema-test-audit'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Audit history deletion accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "Payment" (id,"schoolId","studentId","amountPaise","paidOn",mode,"receiptNumber","requestKey","requestHash","recordedById","recordedByName","studentName","studentAdmissionNumber","schoolName") VALUES ('schema-test-payment-dup','schema-test-a','schema-test-student-a',1000,'2026-05-01','CASH','SYNTHETIC-2','synthetic-key','synthetic-hash','synthetic-actor','Synthetic actor','Synthetic A','0001','Synthetic school');
  EXCEPTION WHEN unique_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate request key accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "Discount" (id,"schoolId","studentId","amountPaise",reason,"requestKey","requestHash","recordedById","recordedByName") VALUES ('schema-test-incomplete','schema-test-a','schema-test-student-a',100,'Synthetic discount','synthetic-incomplete','hash','synthetic-actor','Synthetic actor');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Incomplete allocation total accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN
    INSERT INTO "Discount" (id,"schoolId","studentId","amountPaise",reason,"requestKey","requestHash","recordedById","recordedByName") VALUES ('schema-test-overdiscount','schema-test-a','schema-test-student-a',9001,'Synthetic discount','synthetic-overdiscount','hash','synthetic-actor','Synthetic actor');
    INSERT INTO "DiscountAllocation" (id,"schoolId","discountId","chargeId","amountPaise") VALUES ('schema-test-over-allocation','schema-test-a','schema-test-overdiscount','schema-test-charge-a',9001);
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Oversettled charge accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN UPDATE "AcademicYear" SET "startsOn"='2026-05-01' WHERE id='schema-test-year'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Year dates invalidating enrollment accepted'; END IF; checks:=checks+1;
  INSERT INTO "FeeComponent" (id,"schoolId",name) VALUES ('schema-test-component','schema-test-a','Synthetic tuition');
  INSERT INTO "FeePlan" (id,"schoolId","academicYearId","classId","createdById") VALUES ('schema-test-plan','schema-test-a','schema-test-year','schema-test-class','synthetic-actor'),('schema-test-plan-next','schema-test-a','schema-test-year-next','schema-test-class-next','synthetic-actor');
  INSERT INTO "FeePlanItem" (id,"schoolId","planId","componentId",label,installment,"amountPaise","dueOn") VALUES ('schema-test-item','schema-test-a','schema-test-plan','schema-test-component','Synthetic tuition',1,10000,'2026-04-10'),('schema-test-item-next','schema-test-a','schema-test-plan-next','schema-test-component','Synthetic tuition',1,10000,'2027-04-10');
  rejected:=false; BEGIN
    INSERT INTO "EnrollmentFeeAssignment" (id,"schoolId","enrollmentId","academicYearId","classId","feePlanId","createdById") VALUES ('schema-test-assignment-bad','schema-test-a','schema-test-enrollment-a','schema-test-year','schema-test-class','schema-test-plan-next','synthetic-actor');
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Fee plan from another class/year accepted'; END IF; checks:=checks+1;
  INSERT INTO "EnrollmentFeeAssignment" (id,"schoolId","enrollmentId","academicYearId","classId","feePlanId","createdById") VALUES ('schema-test-assignment','schema-test-a','schema-test-enrollment-a','schema-test-year','schema-test-class','schema-test-plan','synthetic-actor');
  rejected:=false; BEGIN
    INSERT INTO "StudentCharge" (id,"schoolId","enrollmentId","planItemId",label,"amountPaise","dueOn") VALUES ('schema-test-charge-bad','schema-test-a','schema-test-enrollment-a','schema-test-item-next','Wrong item',10000,'2026-04-10');
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Charge from another assigned plan accepted'; END IF; checks:=checks+1;
  INSERT INTO "StudentStatusHistory" (id,"schoolId","studentId","newStatus","effectiveDate","recordedById") VALUES ('schema-test-status','schema-test-a','schema-test-student-a','ACTIVE','2026-04-01','synthetic-actor');
  rejected:=false; BEGIN UPDATE "StudentStatusHistory" SET reason='Changed history' WHERE id='schema-test-status'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Status history rewrite accepted'; END IF; checks:=checks+1;
  rejected:=false; BEGIN DELETE FROM "PaymentAllocation" WHERE id='schema-test-allocation'; EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Allocation deletion accepted'; END IF; checks:=checks+1;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AND has_table_privilege('anon','public."Student"','SELECT') THEN RAISE EXCEPTION 'Anonymous role can read Student'; END IF; checks:=checks+1;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND has_table_privilege('authenticated','public."StudentIdentifier"','SELECT') THEN RAISE EXCEPTION 'API authenticated role can read identifiers'; END IF; checks:=checks+1;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'Public table without RLS'; END IF; checks:=checks+1;
  RAISE NOTICE 'Passed % schema regression checks',checks;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
