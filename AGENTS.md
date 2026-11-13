# School Fee Manager

## Working style
- Keep replies concise. Explain decisions and meaningful tradeoffs; skip basic tutorials unless asked.
- Read existing code before editing. Implement one focused feature at a time.
- Make reasonable reversible decisions independently. Ask when missing information changes product behavior or account ownership.
- Do not spawn additional agents unless requested.
- Keep searches and command output targeted; do not read dependency folders or dump entire repositories.

## Stack and architecture
- Next.js App Router, TypeScript, Tailwind CSS, Prisma with PostgreSQL.
- Use existing components and conventions; discuss major stack changes or new services first.
- Validate server inputs with Zod. Enforce authentication and admin/accountant authorization on the server.
- Keep payment and fee calculations in testable services. Use integer minor units or database decimals for money, never floating-point arithmetic.
- Record fee/payment changes with an audit trail. Use transactions for related writes and prevent duplicate payment submissions.
- Use synthetic student/payment data during development. Never commit secrets, private keys, real student data, or local environment files.

## Git and publishing
- GitHub owner: YashSharma-hsfd. Repository: https://github.com/YashSharma-hsfd/school-fee-manager. Configured SSH origin: git@github.com:YashSharma-hsfd/school-fee-manager.git. Verified local commit name: Yash Sharma. Verified local commit email: yash.sharma@informatik.hs-fulda.de. User verified SSH authentication as YashSharma-hsfd and reported the remote check completed successfully. This session cannot write .git/config.
- Verify the SSH-authenticated GitHub account matches the intended owner or authorized collaborator before the first push.
- Use repository-local Git identity and SSH configuration rather than changing global defaults.
- Use feature branches such as feat/student-management or fix/payment-validation. Keep main deployable.
- Do not commit, push, merge, deploy, or change repository visibility unless the user requests that action or has established a standing instruction for it.
- Never force-push, rewrite shared history, discard unrelated edits, or delete production data without explicit authorization.

## Verification and handoff
- Package manager: npm. Generate and commit package-lock.json with the first successful dependency installation; use npm ci thereafter.
- Run npm run lint, npm run typecheck, relevant tests, and npm run build for code changes when dependencies are available.
- Add meaningful tests for authorization, calculations, payment recording, and regressions. Use Playwright for critical end-to-end flows.
- For documentation-only changes, inspect the diff; application tests are unnecessary.
- Report what changed, checks run, and any remaining blocker. Never claim an unrun check passed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
