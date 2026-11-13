# Development setup

## Current state

The repository has a Next.js starter with installed dependencies and a package lockfile. Student creation now has a Prisma model, an initial migration, validated contact fields, admission-number normalization, and an admin-only service with unit tests. Authentication and the student UI are not implemented yet. The service's `readSession` dependency must resolve a verified server session before a route or server action exposes it; never populate that dependency from request data. Its repository dependency accepts Prisma's `prisma.student` delegate.

The migration has not been applied to a database. Set a development `DATABASE_URL` and run `npm run db:migrate` before connecting the student service. Admission numbers are stored uppercase and unique school-wide. Student creation requires name, admission number, class, guardian name, and guardian phone. No real student records are included.

The SSH origin and local commit identity are configured and verified. This session cannot write `.git/config` or create branch references. No commit or push has been made for student management.

Latest local verification: lint passed with an existing PostCSS export warning; typecheck and all 16 unit tests passed. The default Turbopack build failed when its CSS worker exited during startup in this environment. `npx next build --webpack` passed. Git branch creation remains blocked by read-only `.git` access, and the SSH check could not resolve `github.com`.

Playwright verification is incomplete: the development-server startup stalled, and a retry could not detect the running production server and attempted to start another server. Both browser runs were stopped; no browser-test pass is claimed.

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

Do not overwrite an existing .env. Commit package-lock.json after installation. Schema models and an initial migration are a separate feature; use a development database for npm run db:migrate.

## 4. Feature workflow

1. Describe one feature and its acceptance criteria.
2. Create a feature branch; inspect the existing implementation.
3. Implement it and test the relevant behavior.
4. Run lint, typecheck, relevant tests, and build; inspect the diff.
5. Commit and push when requested, open a pull request, review, then merge.
6. Validate a preview deployment before releasing to production.

GitHub Actions now checks lint, types, unit tests, build, and the placeholder dashboard browser flow on pushes and pull requests. The workflow does not require database secrets; database integration tests are still pending.

Next milestones: login and roles; student UI and fee schedules; payments and receipts; reports and audit history; deployment. Keep development and production databases separate and arrange backups before using real records.

Deployment provider, database provider, currency, academic-year rules, and receipt numbering remain decisions to make before implementing the affected features.

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
