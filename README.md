# School Fee Manager

Next.js App Router, TypeScript, Tailwind, Prisma/PostgreSQL and Zod. Staff authentication, school-scoped student administration, fee configuration, enrollment, payments, discounts, receipts and current-balance reports are implemented.

## Run locally

Requires Node.js 22.12+, npm and local PostgreSQL. Use synthetic data during development.

1. Run `npm ci`.
2. Create `.env` from `.env.example` only if it does not already exist; set `DATABASE_URL`.
3. Stop any running development server, then run `npm run db:prepare` to apply committed migrations and regenerate Prisma Client.
4. Run `npm run dev -- --webpack` and open `/login`.

Restart after Prisma schema or environment changes. Normal page/component changes hot reload. If Prisma generation reports a locked `query_engine-windows.dll.node`, stop the running app before retrying. Never use `prisma migrate reset` against records you need to keep.

## Staff and school setup

There is no public signup. Provision staff with `npm run staff:create`, using shell variables `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_ROLE` (`ADMIN`, `ACCOUNTANT` or `MANAGEMENT`) and `STAFF_PASSWORD` (12–256 characters). Remove the password variable afterward. The command never overwrites an existing account. Do not commit secrets.

1. Sign in as an administration account and open `/schools`.
2. Create each school with its real name and a permanent unique receipt-prefix code. There is no hardcoded two-school limit. The creator gets administration, fee-configuration and staff-access permissions for that school.
3. In Configuration, create academic years (normally April–March), classes, and class fee plans.
4. Add the other provisioned staff accounts to each school, selecting their school-specific role and any explicit configuration/access grants. Global login roles only choose a landing page; school memberships authorize school operations.
5. From Student records, add students or use the school's explicit assignment form for records created before school scoping. Unassigned records are not guessed into either school. Admission numbers are unique within each school.
6. New students receive current-year fees automatically if their class name matches a configured class fee plan. Otherwise, open View account and save an academic-year record. Repeating the same enrollment does not duplicate charges.
7. Promote manually from the student account by selecting the next academic year and class. Previous-year records and unpaid charges remain. Once an enrollment exists, changing class through the generic details form is blocked to avoid replacing fee obligations accidentally.
8. Accountants record arbitrary partial payments, apply discounts with reasons, print/reprint receipts, and reverse incorrect payments. Management has read-only accounts/reports by default.

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

Sessions use hashed random tokens, expire after eight hours, and recheck current database active status and role. Sign-out revokes the token. Production requires HTTPS for secure cookies. Login attempts are limited per email across instances. Account recovery and a staff-account provisioning UI are not implemented.
