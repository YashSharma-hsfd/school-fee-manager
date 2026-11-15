# Fee records: implemented rules

## Schools and permissions

- Independent schools have separate memberships, students, classes, years, fee components, receipts and reports. Composite foreign keys prevent cross-school references in the ledger.
- School roles: administration manages students/enrollment; accountants record payments, discounts and payment reversals; management views reports and student accounts.
- Fee configuration and staff-access management are explicit grants, independent of operational role. The school creator receives both grants. A user can have different roles in different schools.
- Existing students remain unassigned after migration. Original administration accounts with administration membership in the selected school must explicitly assign them. No transfer workflow is implemented.
- Student lifecycle is Active, Inactive or Withdrawn. Only school administration can change status, with a reason and a stale-record check. Each transition is audited. Existing students migrate as Active. Directories default to Active, with explicit inactive/withdrawn/all filters; financial reports and dashboard balances include all statuses.

## Enrollment, fees and due dates

- A student keeps one identity. An enrollment is their class/academic-year record; individual and selected bulk promotion create another record without replacing earlier obligations. Bulk promotion requires a later destination year and configured fee plan, accepts at most 100 selected source-class students per batch, and rolls back the whole batch on conflict. Repeating enrollment does not duplicate charges.
- Inactive/withdrawn students are excluded from the bulk preview and rejected by server-side enrollment, including if status changes after preview. Reactivation is required to enroll/promote again. Withdrawal takes effect immediately and never cancels or prorates existing charges, including future installments. Payments, discounts, corrections and receipt reprinting remain available for settling their accounts.
- Academic years have explicit start/end dates and must not overlap within a school. April–March is the normal setup; dates are entered manually.
- Fee component names are school-configurable records, not database columns. Each class/year has a fixed fee plan, split into monthly, quarterly or annual due-date installments.
- Installment splitting uses exact integer minor units and preserves the annual total, including rounding remainders. The first due date must be on or before the 28th; all installments must fit in the academic year.
- Students may pay any amount at any time. The due schedule controls overdue analysis, not payment frequency.
- Enrollment copies fee labels, amounts and due dates into student charges. A repeated enrollment is idempotent. Existing class/year enrollments cannot be replaced with another class. Fee plans have no editing/deletion endpoint. Fee configurators can correct an individual posted amount/due date, with optimistic stale-form checks and an audit of the reason and before/after values. Amounts must stay positive and cannot fall below active payments plus discounts; a full waiver can be recorded as a discount.
- New-student creation auto-enrolls when a matching class plan exists for the current academic year. Students without a matching plan need explicit enrollment after configuration. Adding a plan does not silently bill all existing students.
- CSV import is a separate new-student workflow with preview, exact headers, size/row limits and atomic duplicate checks. It never auto-enrolls. An imported opening balance is a charge linked directly to its school/student, with no enrollment or plan item. Database constraints allow exactly one source and one opening charge per student. Carried dues are included in oldest-first settlement, receipts and current reports. Do not also import fees you intend to assign through enrollment.

## Payments, discounts and corrections

- Payments and discounts allocate to the oldest unpaid charges first, including previous academic years and then future installments. Overpayments and excessive discounts are rejected; unallocated credit is not supported yet.
- Discounts require an amount and reason, not approval. Actor and timestamp are recorded.
- Each payment stores amount, payment date, mode, optional transaction reference, school-specific sequential receipt number, recording staff identity and timestamp. Student name, admission number and school name are snapshotted so reprints retain original identity details.
- Receipts can be printed/reprinted. Reprinting never consumes a new receipt number.
- Incorrect payments are reversed with a reason; the original receipt and allocations remain, marked reversed, and stop reducing outstanding dues. A corrected payment gets a new receipt.
- Accountants can reverse incorrect discounts with a reason. Original discounts/allocations remain, but reversed credits no longer reduce balances or contribute to active discount totals. Reversal retries do not create another reversal event.
- Transactions run at serializable isolation with bounded retries. Database uniqueness constraints and submission fingerprints prevent duplicate payments/discounts and detect changed payloads reusing a submission key.
- Monetary writes have database positivity constraints. Money uses integer minor units with two decimal places and no floating-point calculations. Currency conversion is outside scope.

## Reports and audit

- Outstanding is all posted charges minus active payment allocations and active discount allocations. Promotion never resets a balance.
- Overdue includes remaining balances with due dates before today's school date. Due today is still current. Reporting uses Asia/Kolkata as the initial school timezone.
- Reports show students with fees assigned, fully paid, up to date, overdue, remaining balances, net received collections, and discounts. Students without charges are shown separately from fully paid students.
- Student balances remain current-state, all-academic-year reports. Collections support inclusive payment-date filters and totals by payment mode, with CSV exports of all matching active payments. Current overdue students can be exported separately. Exported text is quoted and spreadsheet formulas are neutralized. Historical as-of balances are not implemented.
- Reports share literal name/admission/guardian-name/phone search, exact class and student-lifecycle filters. Balances additionally support overdue, any outstanding, fully paid, up to date and fees-not-assigned statuses; summary totals and the balance export match that selection. Dates and payment mode affect collections/history only. The overdue export always selects overdue accounts within the shared student filters. Exports include every matching row, independent of pagination. Class/lifecycle filters describe the current student record.
- Transaction history/export includes original payments, discounts, payment reversals and discount reversals as separate events, with current record state and signed cash/discount changes. Original payments use paidOn; discounts and reversals use their school-local activity date, converting stored UTC timestamps to Asia/Kolkata. Sum signed change columns, not absolute event amounts. Payment-mode filters exclude discount events. Transaction-period cash changes can differ from net active-payment collections when a reversal falls in a different period; these are ledger corrections, not refund/bank-movement reports.
- Audit history supports staff-name, action, exact record ID and inclusive Asia/Kolkata date filters with pagination. These filters are independent of collection dates and retained during pagination.
- Dashboards show school-local daily/monthly collections, all-status outstanding/overdue amounts, lifecycle counts, active students without charges and the five most recently recorded active payments. Role-specific actions do not grant additional permissions.
- School setup, fee plans, enrollments, student changes, payments, discounts, reversals and staff grants create audit events in the same transaction. Application endpoints append audit events and do not provide audit editing/deletion. Production database privileges/backups must be configured before real records are used; a database superuser can alter data directly.

## Deferred scope

- Native Excel workbook import (`.xlsx`/`.xls`); the existing import/template uses Excel-compatible CSV UTF-8.
- Midyear class correction/proration, refunds, optional services and other exceptions.
- Fee-plan amendment/versioning UI. Current class/year plans are fixed after creation; do not use them with real data until configuration has been verified.
- Automatic withdrawal clearance/proration, notifications, and school timezone/currency settings UI.

Tests use synthetic records and disposable databases. No production data is imported or deleted by application features.
