# Development setup

## Current state

MVP feature scope is frozen after student lifecycle and the operational dashboard; see docs/mvp-scope.md. The application includes school-scoped student administration, staff authentication/memberships, fee plans/enrollment, partial payments/receipts, reversals/corrections, dated collection reports/exports, CSV import, bulk promotion, staff recovery, audit filters and the operational dashboard. Native Excel support and further product features are deferred.

Student lifecycle is Active/Inactive/Withdrawn with audited reasons and reactivation. Non-active students cannot enroll/promote; existing charges, receipts and collections remain. Directory filters default to Active, while financial totals include all statuses. Dashboards show school-local daily/monthly collections, outstanding/overdue amounts, lifecycle counts, no-fee alerts, recent receipts and role-specific shortcuts.

The new 20261115150000_student_status migration adds lifecycle fields and an index; existing students become Active. It has not been applied to the development database in this session. Stop the app, then run `npm run db:prepare` before using the new code. No database reset is needed.

Verification on 2026-11-15: 132 unit tests, typecheck, Prisma schema validation and the isolated Webpack production build passed. Lint passed with the existing PostCSS warning. Fifteen PostgreSQL tests are gated by FEES_E2E; the isolated runner could not reach localhost:5432 from this execution environment. Earlier, the user independently verified PostgreSQL access and passed all 136 tests and the production build for the preceding feature set. New lifecycle/dashboard database regressions bring the expected full count to 147. Browser tests remain deferred at the user's request; new lifecycle coverage has been added but not run.

For constrained local builds, set `NEXT_BUILD_WORKERS=1` to use a single static-generation worker. `npm run build -- --webpack` is available if the default Turbopack worker fails. Set `NEXT_TEST_BUILD=1` to use the separate .next-test folder. These flags do not change product behavior. This session has not committed or pushed the feature changes.

## Manual-review refinements (2026-11-16)

Implemented clearer link/button/file-picker affordances, class and guardian search in student directories, independent lifecycle/fee-status filters, filtered balance/collection downloads and full transaction history/export including discounts and both reversal types. Invalid report ranges show an error rather than falling back to unfiltered results. Filters persist through pagination/downloads and reset correctly in the visible form. No schema migration is needed for these refinements.

Latest verification: 138 unit tests, typecheck and lint passed (one pre-existing PostCSS warning). Sixteen PostgreSQL tests are available (expected combined count 154), but database access remains blocked in this execution environment. The current isolated Webpack build attempt failed with EPERM creating a generated output directory; no current build pass is claimed. Browser automation remains deferred by the user. Added regression coverage for shared filter scopes, numeric signed reversal exports, school-local activity dates and full-history reconciliation.

## Role workflow UI (2026-11-16)

The school and administration layouts now share one workspace header with school-specific role badges, active navigation, school switching and account actions. Accountant landing lists assigned schools directly. A dedicated school/student search route reuses the existing directory and authorization guard. Role guides, account task anchors, guardian identity details, setup-section shortcuts and a receipt-to-next-student action make the three role paths explicit. See docs/user-workflows.md.

UI-only refinement: existing financial rules and server authorization remain unchanged, and no migration is required. Latest checks: 143 unit tests, typecheck, lint (existing PostCSS warning) and diff checks passed. Sixteen database tests remain unrun in this environment. The build attempt was blocked by EPERM creating generated .next-test files. Browser role-walkthrough scenarios were added but remain deferred; full browser/production UI validation is not claimed. These changes have not been committed or pushed.

## 1. Local tools

Install Node.js LTS with npm on Windows, reopen the terminal and Codex, then verify:

```powershell
node --version
npm --version
git --version
ssh -V
```

GitHub CLI is optional. SSH handles Git fetch/push; it does not create repositories or pull requests. Use GitHub's website for those, or install and authenticate the CLI separately.

## 2. Choose the GitHub identity

Configured GitHub owner: [YashSharma-hsfd](https://github.com/YashSharma-hsfd). Verified local commit name: Yash Sharma. Verified local commit email: yash.sharma@informatik.hs-fulda.de. Origin is configured as git@github.com:YashSharma-hsfd/school-fee-manager.git. The commands below are reference steps for a fresh checkout; they have already been completed here. Commit identity and SSH login are separate settings.

Run locally when GitHub is reachable:

```powershell
ssh -T git@github.com
```

GitHub should greet YashSharma-hsfd. A successful GitHub SSH authentication test normally exits with status 1 because shell access is unavailable. Verify any first-connection host fingerprint against GitHub's official documentation before accepting it. Never paste or upload a private key; only a .pub key belongs in GitHub settings.

If multiple accounts are used, assign a dedicated key to this repository. After selecting the correct paths and identity, use the following template (replace every placeholder):

```powershell
git config --local user.name "Yash Sharma"
git config --local user.email "yash.sharma@informatik.hs-fulda.de"
git config --local core.sshCommand 'ssh -i C:/Users/hp/.ssh/YOUR_KEY -o IdentitiesOnly=yes'
git remote add origin git@github.com:YashSharma-hsfd/school-fee-manager.git
git ls-remote origin
```

Create an empty repository under the chosen owner first. If origin already exists, inspect it before using git remote set-url. Repository-local configuration is machine-specific and is not shared through commits. Do not execute placeholder commands unchanged.

## 3. Install and run

```powershell
npm ci
Copy-Item .env.example .env
# Set DATABASE_URL in .env to your development PostgreSQL database.
npm run db:generate
npm run dev
```

Do not overwrite an existing .env. Commit package-lock.json after installation. Apply committed migrations and generate the client with npm run db:prepare while the development server is stopped. Use a development database for npm run db:migrate.

## 4. Feature workflow

1. Describe one feature and its acceptance criteria.
2. Create a feature branch; inspect the existing implementation.
3. Implement it and test the relevant behavior.
4. Run lint, typecheck, relevant tests, and build; inspect the diff.
5. Commit and push when requested, open a pull request, review, then merge.
6. Validate a preview deployment before releasing to production.

GitHub Actions checks lint, types, unit tests, build, and staff browser flows using a temporary PostgreSQL service with synthetic records. No external database secrets are needed.

Implemented: school-scoped student management, fee plans and due dates, enrollment, partial payments, discounts, receipts, reversals, reports and audit history. Next milestones: Excel imports, configuration amendments, deployment. Keep development and production databases separate and arrange backups before using real records.

Deployment and production database providers remain open. See docs/fee-records.md for implemented academic-year, receipt, permission and payment rules.

## 5. Working with Codex efficiently

AGENTS.md holds the shared repository rules. Keep it short and update it when a lasting decision changes. It guides the agent; SSH keys and application permissions enforce actual access.

Use a focused prompt, for example:

> Implement student creation with admission number, name, class and guardian contact. Admin only; reject duplicate admission numbers. Follow AGENTS.md, run relevant checks, and leave the changes uncommitted.

Use one task per feature, name acceptance criteria, and avoid repeatedly attaching the entire codebase. Use deeper reasoning for architecture, authorization, or difficult bugs and a lighter setting for straightforward edits. Keep final replies short, but preserve necessary verification.

Tokens include model inputs, outputs, and reasoning; instructions, conversation context, code excerpts, and tool results contribute to input. A short reply alone does not imply a cheap task. Longer tasks and repeated attempts can consume more allowance. ChatGPT subscription usage limits and API token billing are different; consult the usage dashboard for the active account rather than assuming a fixed cost per message.

Official references:
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/pricing
- https://chatgpt.com/codex/settings/usage
- https://docs.github.com/en/authentication/connecting-to-github-with-ssh
