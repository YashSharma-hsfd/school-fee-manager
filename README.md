# School Fee Manager

Minimal Next.js App Router starter using TypeScript, Tailwind CSS, shadcn/ui conventions, Prisma/PostgreSQL, Zod, React Hook Form, and TanStack Table. Vitest and Playwright are configured.

## Start

Requires Node.js 22+ and npm.

```sh
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

Set `DATABASE_URL` to your PostgreSQL connection. No database tables or migrations exist yet. Once models are added, run `npm run db:migrate`.

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
- `prisma` — schema and future migrations
- `tests/unit`, `tests/e2e` — automated checks

The dashboard is a placeholder. Authentication and role enforcement are not implemented. React Hook Form and TanStack Table are installed dependencies reserved for feature development.

Dependencies could not be installed in the initial restricted environment; generate and commit package-lock.json after the first npm install. Checks have not yet run.

