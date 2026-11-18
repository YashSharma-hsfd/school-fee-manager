# Finalized school database

The base finalized schema was implemented on the `school-fee-manager-pilot` database in the Yash Sharma organization.
The late-fee extension requires its separate migration on each database; local verification does not deploy it to the cloud.
The authoritative field names, nullability, enums and PostgreSQL native types are in
[`prisma/schema.prisma`](../prisma/schema.prisma). SQL-only constraints and triggers
are versioned in the Prisma migrations. The current schema has **28 application tables**, plus
Prisma's internal `_prisma_migrations` table.

## Table inventory

| Area | Table | Responsibility |
|---|---|---|
| School | `School` | Exactly nine agreed fields: ID, name, code, email, phone, logo path, receipt sequence, creation and update timestamps |
| Access | `User` | Staff identity, normalized email, password hash, login role, active status and explicit platform-administrator flag |
| Access | `SchoolMembership` | School-specific role, fee/access grants, active status and timestamps |
| Access | `Session` | Hashed session token, user, creation and expiry timestamps |
| Access | `LoginAttempt` | Login throttling by normalized email |
| Student | `Student` | Mandatory school, admission number, name and DOB; optional gender, blood group, admission date and photo; status and timestamps |
| Student | `StudentAddress` | One current and one permanent address per student |
| Student | `Guardian` | School-owned parent/contact identity; phone, alternate phone, email and occupation |
| Student | `StudentGuardian` | Mother/father/other relationship, primary and emergency flags; siblings may share a guardian within their school |
| Student | `IdentifierType` | School-specific identifier codes, names and sensitivity classification |
| Student | `StudentIdentifier` | One text value per student/type, preserving leading zeros |
| Student | `StudentDocument` | Private file metadata, size, path, upload actor and timestamp |
| Student | `StudentStatusHistory` | Append-only status history, effective calendar date, recorded timestamp, reason and actor |
| Academic | `AcademicYear` | School session dates, name and closure flag |
| Academic | `SchoolClass` | School-specific class name, sort order and active status |
| Academic | `ClassSection` | Section scoped to school, academic year and class |
| Academic | `Enrollment` | Student/year placement, section, roll number and participation dates |
| Fees | `EnrollmentFeeAssignment` | Optional fee-plan assignment, independent of academic enrollment |
| Fees | `FeeComponent` | School-specific fee categories and active status |
| Fees | `FeePlan` | One plan per school/year/class |
| Fees | `FeePlanItem` | Component, installment, label, integer paise and due date |
| Fees | `LateFeePolicy` | Append-only rates, recurrence frequency and effective dates per school/class fee plan |
| Fees | `StudentCharge` | Assigned principal, imported opening due or uniquely identified installment/cycle late fee; see [late-fee rules and rollback](late-fees.md) |
| Finance | `Payment` | Payment, method enum, receipt snapshots, idempotency and reversal details |
| Finance | `PaymentAllocation` | Immutable distribution of payment across a student's charges |
| Finance | `Discount` | Discount, reason, idempotency, recorder and reversal details |
| Finance | `DiscountAllocation` | Immutable distribution of discount across a student's charges |
| History | `AuditEvent` | Append-only school, actor snapshot, action, entity type/ID, structured details and timestamp |

## Rules enforced

- IDs use CUID text. Models are singular PascalCase; columns use camelCase.
- DOB, admission, enrollment, academic and due dates use PostgreSQL `date`.
  Event timestamps use `timestamptz(3)`; existing event timestamps are interpreted
  explicitly as UTC during migration. Database triggers maintain `updatedAt`, including
  SQL writes outside Prisma, without losing optimistic-edit version protection.
- `Student.schoolId` is required and immutable. Admission numbers are normalized
  uppercase text and unique within the school. DOB is never fabricated or null.
  Admission date may be null and cannot precede DOB. Previous-school name is omitted.
- School-owned relationships use composite foreign keys. Sections must match both
  class and academic year. Fee assignments must match enrollment school/class/year.
  Charge items must belong to the assigned plan. Allocation targets must belong to
  the payment/discount's student, not just its school.
- There is one enrollment per student/year. Its school, student, class, year and
  section cannot change after creation. Enrollment dates must fall inside the year.
  Year-date edits cannot invalidate existing enrollment dates.
- Roll numbers are optional text, unique by school/year/class/section. A partial
  `NULLS NOT DISTINCT` index also protects classes with no sections. Roll numbers
  can differ in later academic years. There is at most one primary guardian contact.
- Financial values use integer `amountPaise`. Payment methods use a controlled enum.
  Receipt numbers and request keys are unique within a school. Payments/discounts
  retain original snapshots and are reversed rather than overwritten or deleted.
  Deferred checks require allocations to equal the entry amount and prevent charges
  being oversettled. Server writes use serializable transactions with conflict retries.
- Academic enrollment may exist without fees. Student accounts and school dashboards
  explicitly flag missing fee configuration. Creating the class fee plan assigns
  charges to already-enrolled students in the same transaction. Repeating assignment
  preserves existing charges. Opening balances alone do not mean current-year fees
  have been configured.
- Class search includes historical enrollments; class labels show the most recent
  placement. Guardian searches include all linked contacts. Historical financial
  receipt identity is retained independently of current profile labels.

## Access and privacy

`User.role` is the default login/navigation role, not cross-school authorization.
Every school action requires an active `SchoolMembership`; an administrator of one
school has no implicit access to another. `User.isPlatformAdmin` separately controls
school creation. The existing pilot bootstrap administrator retains this authority;
new school staff are not platform administrators. CLI provisioning can explicitly set
`STAFF_PLATFORM_ADMIN=true` for an authorized platform owner.

All public application tables and Prisma history have RLS enabled with no API policies,
and grants to Supabase `anon` and `authenticated` roles are revoked. This intentionally
blocks direct Data API access. Supabase Auth is not used by this app; `auth.uid()` policies
would not represent the custom staff sessions. The current server connection is the
database owner and therefore still relies on server authorization for school isolation.
Before hosting, provision restricted application credentials and matching authorization
policies; do not assume this default-deny API configuration provides tenant RLS for an
owner connection. Keep the unused Data API disabled.

Sensitive identifiers and private file references are not read by ordinary directory,
report or receipt queries. `isSensitive` is a classification, not encryption or a grant
of permission. Identifier reveal/export and upload/download screens must explicitly
authorize access before these modules accept real data. Storage paths are school-prefixed;
document paths reject traversal. Private storage buckets and signed download URLs still
need configuring when uploads are implemented.

## Migration and verification

1. `20261116090000_finalize_school_database` adds the agreed structure, renames
   monetary/access/actor fields without changing their values, and adds invariants.
2. `20261116093000_index_school_relationships` adds covering indexes for school-owned
   foreign keys, including student ledgers and charge allocation lookups.

The first migration refuses a populated legacy `Student` table before making changes:
legacy records lack mandatory DOB and require an explicit, verified conversion of
profile, guardian and enrollment data. Do not reset a populated database or fabricate
birth dates to bypass this preflight. The pilot had no student/financial data, and its
existing staff account was preserved.

If local preparation reports an aborted transaction, run `npm run db:check`.
It performs read-only checks before any DDL and reports legacy records or a failed
Prisma migration marker without printing credentials or student details. `db:prepare`
runs the same checks before deployment. Do not mark a failed migration as applied.
Prisma Client generation runs after the preflight/migration process exits, so that
process cannot hold its own Windows query-engine DLL open during regeneration.
Stop the application dev server before generating Prisma Client on Windows.
Only mark it rolled back after verifying that its transaction left the old schema
intact. Existing local records need a verified conversion plan; resetting disposable
test data requires an explicit decision because it also removes local staff and fees.

For an explicitly approved disposable local database, `npm run db:local:reset`
verifies both the configured URL and the connected server/database before resetting.
It accepts only `school_fee_manager`, the `public` schema and loopback port 5432;
remote/cloud targets and production mode are refused. It keeps the existing local
bootstrap administrator in memory and restores that login after the reset when one
exists. Other dummy data is removed, migrations are reapplied, and Prisma Client is
regenerated. No cloud database is accessed by this command.

The migrations were applied to the pilot and registered with their file checksums in
Prisma's migration history. The initial 18 regression checks in
[`tests/sql/finalized-schema.sql`](../tests/sql/finalized-schema.sql) ran within a
savepoint during migration; all synthetic rows were rolled back. They check required
school/DOB, admission isolation, guardian isolation and primary uniqueness, section/year
matching, placement immutability, roll numbers, date bounds, payment allocations,
immutable receipts, audit preservation and default-deny RLS. The disposable local test
runner also runs this SQL suite before the service/browser tests.

The expanded 28-check SQL suite was subsequently rerun successfully inside a rolled-back transaction.
Live columns/nullability were compared with the Prisma client. Balance and transaction
report SQL was executed against the updated pilot. Local PostgreSQL integration and
Playwright flows remain unverified in this session because local PostgreSQL is unreachable.
A webpack production build passed after the environment reconnected, but the latest
repeat was blocked by a filesystem `EPERM` while creating generated `.next` output.
No application hosting deployment was performed.

## Later modules

Attendance and marks should reference `Enrollment` using the same school-scoped
relationships. Add calendar/sessions/attendance and subjects/offerings/assessments/results
when their business rules are agreed. Keep absence separate from a zero mark, support
decimal marks where required, and version grading rules. These future tables, refunds,
advance credits, transport operations and related screens are not created now.
