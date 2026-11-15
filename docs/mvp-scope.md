# MVP scope — frozen 2026-11-15

The MVP feature scope is frozen after student lifecycle and the operational dashboard. Further pre-launch work is limited to verification, fixes, deployment configuration and backup/restore preparation.

## Included

- Staff sign-in, school-specific roles/grants, staff provisioning and administrator-assisted password recovery.
- Student admissions/contact edits; active, inactive and withdrawn status with reasons, reactivation and audit history.
- Academic years, classes, fixed fee plans, individual enrollment and selected bulk promotion.
- Partial payments, discounts, corrections/reversals, duplicate-submission protection and preserved previous-year dues.
- Receipt printing/reprinting and saving as PDF through the browser print dialog.
- Current-balance/overdue reports, dated collection totals, CSV exports and audit filters.
- Existing CSV student/opening-dues import; native Excel workbook support is deferred.
- School dashboards with daily/monthly collections, outstanding/overdue totals, lifecycle counts, no-fee alerts, recent receipts and role-appropriate shortcuts.

Inactive/withdrawn status takes effect immediately and blocks further enrollment/promotion. It does not cancel any charges, including future installments. Existing accounts remain available for collecting dues and printing receipts. Status changes require school administration permission, a reason and a current record version. Reactivation restores enrollment eligibility.

## Deferred

Native `.xlsx`/`.xls` import, direct PDF downloads, refund handling, automatic withdrawal clearance/proration, fee-plan versioning, notifications, online payments and school timezone/currency settings.

## Before launch

- Apply committed migrations and verify against a disposable PostgreSQL database.
- Run the critical browser flows (currently deferred by the user), including withdrawal/reactivation and dashboard totals.
- Complete production build/deployment verification and configure HTTPS/environment secrets.
- Configure database access privileges and backups, and verify a restore using synthetic data.
