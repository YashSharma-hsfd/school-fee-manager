# Late fees

Implementation is isolated in `src/services/late-fees.ts` and the pure calculator `src/services/late-fee-calculations.ts`. Configuration controls are in `src/components/late-fee-settings.tsx`; the server action is `src/actions/late-fees.ts`.

## Rules

- Amount is configured per class fee plan, in rupees in the form and integer paise in storage. Zero leaves late fees off.
- An installment includes all fee components sharing an enrollment and due date. Any unpaid principal balance incurs one flat penalty per cycle, regardless of the number of fee components.
- Only assigned class-plan installments participate; imported opening balances do not generate penalties.
- Fifteen full calendar days after the due date are allowed. A fee due April 10 has grace through April 25; its first penalty is due April 26. Dates use Asia/Kolkata.
- Each unpaid installment repeats at its original monthly, quarterly or annual frequency, including after the final scheduled installment and academic year. Month-end dates clamp to the last day of shorter months.
- At 100 rupees, two unpaid monthly installments produce 100 in the first cycle and another 200 in the second, totaling 300. Three cycles total 600. Penalty charges never generate further penalties themselves.
- Payments and discounts count on their effective dates. Partial settlement still incurs the full flat penalty. A later reversal restores eligibility for subsequent cycles, without pretending that an earlier payment never existed.
- No penalties predate the policy's effective date. A new enrollment or fee assignment has at least 15 days before becoming eligible. Full annual principal fees remain unchanged.
- Posted charges are preserved, including when a backdated payment is recorded later. Accountants can use **Waive late fees** for an audited concession against penalties only, leaving principal and its future penalty eligibility unchanged. Posting historical payments does not silently erase assessed fees.
- Only a fee configurator can set a policy. Active policy changes start tomorrow or later. Versions are append-only; a newly saved version takes precedence for the same future effective date.

## Posting and reporting

Authorized school access catches up any elapsed cycles before returning the account, dashboard or report. Payment and discount transactions also catch up the affected student's fees before allocating money. There is no dependency on a constantly running development server or a daily job: a later visit catches up all eligible missed cycles.

Penalties use the existing `StudentCharge` ledger and therefore appear in existing balances, reports, collections and receipt allocations. An enrollment, original installment date and cycle date uniquely identify each charge. Serializable transactions and a unique database index prevent duplicate assessments; each new charge has an audit event.

## Disable or roll back

Set `LATE_FEES_ENABLED=false` and restart the application to stop all new assessments and hide configuration controls. This preserves existing charges, payments, discounts, receipts and audit history. Re-enabling catches up eligible cycles that elapsed while the global switch was off. To stop accrual from a specific date rather than pause posting, schedule a zero-amount policy while the module is still enabled. Keep the global switch off for a complete rollback.

The feature adds one migration, `20261118090000_late_fees`. Apply it with `npm run db:prepare` before running this version. No existing plan gains a late fee automatically.

Code can be reverted independently while leaving the additive database migration in place: the old charge ledger can still read and collect already posted penalties. Do not drop the new metadata or delete financial charges as a code rollback. Use **Waive late fees** before removing the feature code when outstanding penalties should be cancelled. It remains available with the global switch off.
