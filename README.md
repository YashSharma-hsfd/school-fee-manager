# School Fee Manager

Next.js App Router, TypeScript, Tailwind, Prisma/PostgreSQL and Zod. Includes school-scoped students, fees, payments, receipts, collection exports, opening-balance imports, corrections, bulk promotion, staff management and searchable audit history.

MVP feature scope is frozen after student lifecycle and the operational dashboard. See [MVP scope](docs/mvp-scope.md).

See [user workflows](docs/user-workflows.md) for the Administration, Accountant and Management screen-by-screen paths. Shared school navigation shows the current role and active page; Student accounts is the dedicated search workspace, with shortcuts from accounts to charges/payment/history and from receipts back to the next student.

Cloud pilot setup: [Neon PostgreSQL setup](docs/cloud-postgresql.md). Dedicated cloud commands use the ignored `.env.cloud.local` file, keeping normal development and tests on the local database.

## Run locally

Requires Node.js 22.12+, npm and local PostgreSQL. Use synthetic data during development.

1. Run `npm ci`.
2. Create `.env` from `.env.example` only if it does not already exist; set `DATABASE_URL`.
3. Stop any running development server, then run `npm run db:prepare` to apply committed migrations and regenerate Prisma Client.
4. Run `npm run dev -- --webpack` and open `/login`.

Restart after Prisma schema or environment changes. Normal page/component changes hot reload. If Prisma generation reports a locked `query_engine-windows.dll.node`, stop the running app before retrying. Never use `prisma migrate reset` against records you need to keep.

## Staff and school setup

There is no public signup. Bootstrap the first administrator with `npm run staff:create`, using shell variables `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_ROLE` (`ADMIN`, `ACCOUNTANT` or `MANAGEMENT`) and `STAFF_PASSWORD` (12-256 characters). Remove the password variable afterward. The command never overwrites an existing account. Do not commit secrets. After setup, global administrators with school access-management permission can create staff from Configuration, reauthenticating with their current password.

1. Sign in as an administration account and open `/schools`.
2. Create each school with its real name and a permanent unique receipt-prefix code. There is no hardcoded two-school limit. The creator gets administration, fee-configuration and staff-access permissions for that school.
3. In Configuration, create academic years (normally April–March), classes, and class fee plans.
4. Add the other provisioned staff accounts to each school, selecting their school-specific role and any explicit configuration/access grants. Global login roles only choose a landing page; school memberships authorize school operations.
5. From Student records, add students or use the school's explicit assignment form for records created before school scoping. Unassigned records are not guessed into either school. Admission numbers are unique within each school.
6. New students receive current-year fees automatically if their class name matches a configured class fee plan. Otherwise, open View account and save an academic-year record. Repeating the same enrollment does not duplicate charges.
7. Promote individually from the student account, or use Import & promotion to preview a source class/year and destination plan, then explicitly select up to 100 students per batch. Previous-year records and unpaid charges remain. Once an enrollment exists, changing class through the generic details form is blocked to avoid replacing fee obligations accidentally.
8. Accountants record arbitrary partial payments, apply discounts with reasons, print/reprint receipts, and reverse incorrect payments. Management has read-only accounts/reports by default.
9. Reports provide inclusive payment-date filters, payment-mode totals, collection CSV exports, current overdue CSV exports, and audit filters by staff name, action, record and school-local date. Collection dates do not change current student balances. Reversed payments and discounts are excluded from active totals.
10. Fee configurators can correct individual posted charge amounts/due dates with a reason. Settled amounts cannot be undercut. Accountants can reverse discounts; the original entries and allocations remain in history.
11. On the student account, administration can set Active, Inactive or Withdrawn with a reason, or reactivate a returning student. Inactive/withdrawn students cannot enroll or promote. All charges (including future installments), payment history and receipts remain. Accountants can still collect dues. Directories default to Active and provide status filters; financial reports include every status.
12. The school overview and admin dashboard show daily/monthly net collections by payment date, outstanding/overdue balances, lifecycle counts, active students with no fees, recent receipts and shortcuts for the signed-in school role. School dates use Asia/Kolkata.
13. Student directories support name/admission/guardian/phone search plus class and lifecycle filters. Reports distinguish lifecycle from fee status, support class/date/payment-mode filters, and keep filters in downloads and pagination. Use Net collections for active receipts; All matching transactions includes original payments/discounts and their reversal events with signed cash/discount changes. Filtered balance and overdue CSVs remain current-state, across all years. See [report definitions](docs/fee-records.md).

## Import existing students

Open Import & promotion and download the CSV template. Fill it in Excel and save as **CSV UTF-8**. Required columns, in order:

```text
admissionNumber,name,className,guardianName,guardianPhone,openingDue,dueOn
```

Keep admission numbers and phone numbers as text to preserve leading zeros. Leave openingDue blank/zero if there is no carried balance. A positive openingDue requires a dueOn date in YYYY-MM-DD format. Preview all rows before confirming. Imports are limited to 500 new students and 512 KB per batch, reject duplicate admission numbers, and save atomically. Existing students are never overwritten. Opening balances are independent ledger charges and participate in payments, discounts, receipts and overdue reports. Import does not assign any new-year fees; enroll those students separately to prevent double billing. Native `.xlsx`/`.xls` import is not implemented.

## Passwords and recovery

Staff can change their own password at `/account`; this revokes all their sessions. In Configuration, administrators with access-management permission can recover active non-administrator staff accounts after verifying identity and entering their own current password. Recovery revokes sessions and clears the sign-in attempt lockout. It is blocked for accounts shared with schools the administrator does not manage. School membership can also be removed without deleting the global account or its audit history.

For forgotten administrator passwords, the system owner can run `npm run staff:reset-password` with `STAFF_EMAIL`, `STAFF_PASSWORD` (12-256 characters), and `STAFF_RESET_REASON` set locally. It only updates an existing active account, revokes its sessions, and records recovery events for its schools. Clear the password variable afterward. This command has no public web endpoint. Email-based self-service recovery is not configured.

See [fee rules and limitations](docs/fee-records.md).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

`npm run test:integration` creates a uniquely named temporary PostgreSQL database, applies migrations, runs unit/integration tests, and removes only the database it created. It requires a local database account with create-database permission. It never runs fee integration tests against your development database.

For browser tests, install Chromium with `npx playwright install chromium`. Set `RUN_BROWSER_TESTS=1` before running the isolated test runner. By default it uses a production build. For local browser verification with an independent Webpack dev server, also set `PLAYWRIGHT_DEV_WEBPACK=1` and `NEXT_TEST_BUILD=1`. Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome instead of downloaded Chromium. The isolated runner uses port 3100; the developer server can stay on 3000.

`AUTH_E2E=1` and `FEES_E2E=1` enable database-writing browser/integration suites only against disposable databases. CI uses a temporary PostgreSQL service, applies migrations, then runs all checks. No production or external database credentials are needed.

## Authentication

Sessions use hashed random tokens, expire after eight hours, and recheck current database active status and role. Sign-out revokes the token. Production requires HTTPS for secure cookies. Login attempts are limited per email across instances. Passwords and password hashes are never included in audit details.
