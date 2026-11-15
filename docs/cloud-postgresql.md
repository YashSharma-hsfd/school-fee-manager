# Cloud PostgreSQL pilot

## Selected setup

- Provider: Neon managed PostgreSQL, Free pilot.
- Project name: `school-fee-manager-pilot` (create under the user's own Neon account).
- Region: AWS Singapore (`aws-ap-southeast-1`), for an India-based pilot. Plan to run the app server nearby. Neon currently offers no India region; confirm data-residency requirements before using real school records.
- Start with an empty cloud database. Local demo students, staff credentials and payments are not automatically transferred.

This document/configuration does not provision a project, activate billing, deploy the app or transfer data. Actual provisioning needs the user's Neon account connection. Production should use its own project and credentials once recovery, cost limits and hosting are agreed.

## Credentials

Create `.env.cloud.local` from `config/cloud-database.env.example` only if it does not already exist. Enter the connection strings privately:

- `CLOUD_DATABASE_URL`: pooled URL copied from Neon for the deployed app.
- `CLOUD_DIRECT_URL`: unpooled/direct URL for migrations and administrative commands.

Both must use TLS (`sslmode=require` or certificate verification) and reference the same endpoint/database. Separate runtime and migration roles are supported. Do not paste credentials into chat or commit the file; `.env.cloud.local` is covered by `.gitignore`.

Existing `.env` stays local. Next.js does not automatically load `.env.cloud.local`. CI and the disposable PostgreSQL test runner stay local and are not pointed at Neon. Prisma's schema is unchanged; the cloud command sets the child process's URL explicitly for the selected direct target. No new driver adapter or service is needed for the current Prisma 6 PostgreSQL connector.

## Initialize and verify the pilot

1. After the project exists, copy its two URLs into the private file. Check the displayed hostname/database carefully when running commands; passwords are not printed.
2. Run `npm run db:cloud:status`. On a new database it can report unapplied migrations and return a non-zero status, which is expected before deployment.
3. Run `npm run db:cloud:deploy` to apply the repository's committed migrations. This never resets the database, runs demo seeds or copies local data. Do not use `prisma migrate dev`, `migrate reset` or `db push` on production.
4. Run `npm run db:cloud:status` again and verify all migrations are applied.
5. For the first cloud administrator, set `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_ROLE=ADMIN`, and a privately chosen `STAFF_PASSWORD` (12–256 characters) in the shell. Run `npm run staff:cloud:create`, then remove `STAFF_PASSWORD` from that shell. This creates an existing-script staff account in the validated cloud target and never overwrites an account. Ordinary `staff:create` still targets local `.env`.
6. On the chosen app host, set its server-only **DATABASE_URL** secret to the pooled connection string. Do not use a NEXT_PUBLIC variable. Keep the unpooled migration credential in the trusted migration job/operator environment, not in browser code. Select an application region near the database.
7. Sign in to the deployed pilot, create a demo school and use synthetic records to verify login, payments, receipts, reports and reversals. Existing local login credentials will not work unless separately provisioned on the cloud database.

## Before real production use

Agree the monthly budget and recovery retention, configure a production database and least-privilege runtime role, take a backup and verify a restore, and verify the hosted app's role workflows over HTTPS. Keep development/preview/test deployments off the production database. The Free pilot does not establish that production recovery requirements are met, and creating a production branch from demo-filled data is not a clean production initialization.

## References

- [Neon regions](https://neon.com/docs/introduction/regions) — region is fixed per project; choose near the application server.
- [Neon Prisma guide](https://neon.com/docs/guides/prisma) — pooled application connections and direct migration connections, including Prisma 6 guidance.
- [Neon plans](https://neon.com/docs/introduction/plans) and [restore history](https://neon.com/docs/postgres/backup-restore/history-window) — review current limits before choosing production recovery/capacity.
