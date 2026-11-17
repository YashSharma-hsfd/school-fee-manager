# Supabase PostgreSQL pilot

Create `school-fee-manager-pilot` under your own Supabase account, using a Free organization and Mumbai (`ap-south-1`). This setup does not create a project or enable billing by itself.

## Project setup

1. Connect your Supabase account, then create the Free pilot project in Mumbai. Choose and store the database password privately.
2. Disable the project's Data API before applying the application migrations. This app accesses PostgreSQL through Prisma and uses its existing authentication. Its public tables include private student and staff data; they must not become publicly accessible through the Data API.
3. Copy `config/cloud-database.env.example` to `.env.cloud.local` only if that file does not already exist. Keep local `.env` unchanged. The cloud file is ignored by Git; never paste credentials into chat.
4. Set `CLOUD_PROJECT_REF` from project settings. Copy connection strings from Supabase's Connect panel, including the actual pooler hostname and username. Do not construct hostnames from region names.
5. Set `CLOUD_DATABASE_URL` to the session pooler on port 5432, or transaction pooler on port 6543 with `pgbouncer=true`. Enable TLS with `sslmode=require` or certificate verification.
6. Set `CLOUD_DIRECT_URL` to the session pooler on port 5432 for IPv4 compatibility, or the direct database endpoint on port 5432 if IPv6 is available. Never use transaction pooling for migrations. Both URLs must reference the same project and database.

## Initialize and verify

Run `npm run db:cloud:status` to check the target. Unapplied migrations are expected on a new database. Run `npm run db:cloud:deploy`, then check status again. These commands use Prisma migration history; do not substitute dashboard SQL execution, migrate reset, db push or demo seeds.

The cloud starts empty. To create the first administrator, privately set `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_ROLE=ADMIN`, and `STAFF_PASSWORD` (12–256 characters) in the shell. Run `npm run staff:cloud:create`, then remove the password variable. Local accounts are not copied.

When deploying the app, set the host's server-only `DATABASE_URL` to the runtime connection string. Never put it in a NEXT_PUBLIC variable. Keep migration credentials in a trusted operator environment. Next.js does not automatically load `.env.cloud.local`; ordinary development and disposable integration tests keep using their existing local configuration.

Verify login, all three role workflows, payments, receipts, reports and reversals using synthetic records before adding real school data. This task does not deploy the application or transfer local records.

## Production and expansion

Supabase remains PostgreSQL, so future student details, guardians, admissions and attendance can be added with versioned Prisma migrations. Existing authentication stays in place. Supabase Auth or document Storage would require separate integration and access policies.

Before real production use, agree budget, backup retention and recovery requirements; verify a restore; use an appropriate production plan and restricted runtime credentials; keep development and preview deployments separate. The Free pilot does not establish production recovery guarantees.

## References

- https://supabase.com/docs/guides/database/prisma
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/regions
