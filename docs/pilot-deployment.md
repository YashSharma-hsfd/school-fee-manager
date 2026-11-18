# Pilot deployment

Deploy the checked `feat/student-management` commit from `YashSharma-hsfd/school-fee-manager` to a Vercel preview first. Confirm the deployed commit SHA; do not accidentally publish an older `main` revision.

## Build and runtime

`vercel.json` selects Next.js, `npm ci`, the Prisma-generation/webpack build and Mumbai (`bom1`), near the pilot Supabase database. Use Node.js 22.x in Vercel project settings to match CI. Database migrations are intentionally operator-run; deployments do not receive migration credentials or mutate the schema during a build.

CI uses `npm run test:integration` to create and remove a uniquely named temporary PostgreSQL database, apply every migration, and run unit, database and browser checks. Neither tests nor cleanup target the real pilot database.

Database-enabled Vitest runs serialize test files because fixture cleanup changes shared database triggers. The `Promise.all` tests within those files still exercise real concurrent payments, reversals and assessments. A startup guard rejects ordinary databases before any test fixtures are written. Application transactions retain Serializable isolation and retry only write conflicts/deadlocks, with bounded exponential backoff and jitter; other database and business-rule errors propagate immediately.

## Vercel variables

| Variable | Pilot value |
|---|---|
| `DATABASE_URL` | The existing `.env.cloud.local` `CLOUD_DATABASE_URL`, entered privately as a server-only variable; use `connection_limit=1` for the initial serverless pilot |
| `LATE_FEES_ENABLED` | `true`, or `false` to stop new late-fee posting |
| `NEXT_TELEMETRY_DISABLED` | `1` |
| `CHECKPOINT_DISABLE` | `1` |

Set variables for the exact environment being deployed. Never use a `NEXT_PUBLIC_` prefix for database credentials. Do not upload `.env`, `.env.cloud.local`, `CLOUD_DIRECT_URL`, operator passwords, or local data to GitHub. This pilot database must contain synthetic data only while preview deployments share it; use a separate database before testing future previews against real school records.

## Pilot smoke check

1. Confirm the deployment is ready and `/login` loads over HTTPS.
2. Sign in using existing cloud staff accounts. Local accounts are not copied.
3. Confirm each role sees only its assigned schools and permitted controls.
4. With synthetic records, record a payment, print/reopen its receipt, check reports, and verify late-fee configuration and concessions.
5. Confirm rollback can restore the previous application deployment; do not undo applied financial migrations or delete records as an application rollback.

Only promote the verified deployment to the stable pilot URL after these checks. School access remains protected by the application's staff login.
