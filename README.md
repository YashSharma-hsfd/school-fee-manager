# School Fee Manager

Minimal Next.js App Router starter using TypeScript, Tailwind CSS, shadcn/ui conventions, Prisma/PostgreSQL, Zod, React Hook Form, and TanStack Table. Vitest and Playwright are configured.

## Start

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env
npm run db:generate
npm run dev
```

Set `DATABASE_URL` to your development PostgreSQL connection, then run `npm run db:migrate` to apply the student migration.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Structure

- `src/app/(auth)` — authentication routes
- `src/app/(dashboard)/admin` and `accountant` — role workspaces
- `src/components/ui` — shadcn/ui components
- `src/actions`, `src/services`, `src/validators`, `src/lib` — application layers
- `prisma` - schema and migrations
- `tests/unit`, `tests/e2e` — automated checks

The dashboard is a placeholder. Authentication and role enforcement are not implemented. React Hook Form and TanStack Table are installed dependencies reserved for feature development.

Student creation has an admin-only service with validated contact fields and duplicate admission-number handling. It is not exposed through a route yet; authentication must supply a verified server session first.

GitHub Actions runs lint, typechecking, unit tests, build, and the placeholder dashboard browser test on pushes and pull requests. CI uses a synthetic database URL; current tests do not connect to a database. Database integration coverage remains pending.

