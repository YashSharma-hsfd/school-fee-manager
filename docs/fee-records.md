# Fee records: implemented rules

## Schools and permissions

- Independent schools have separate memberships, students, classes, years, fee components, receipts and reports. Composite foreign keys prevent cross-school references in the ledger.
- School roles: administration manages students/enrollment; accountants record payments, discounts and payment reversals; management views reports and student accounts.
- Fee configuration and staff-access management are explicit grants, independent of operational role. The school creator receives both grants. A user can have different roles in different schools.
- Existing students remain unassigned after migration. Original administration accounts with administration membership in the selected school must explicitly assign them. No transfer workflow is implemented.

## Enrollment, fees and due dates

- A student keeps one identity. An enrollment is their class/academic-year record; promotion is manual and creates another record without replacing earlier obligations.
- Academic years have explicit start/end dates and must not overlap within a school. April–March is the normal setup; dates are entered manually.
- Fee component names are school-configurable records, not database columns. Each class/year has a fixed fee plan, split into monthly, quarterly or annual due-date installments.
- Installment splitting uses exact integer minor units and preserves the annual total, including rounding remainders. The first due date must be on or before the 28th; all installments must fit in the academic year.
- Students may pay any amount at any time. The due schedule controls overdue analysis, not payment frequency.
- Enrollment copies fee labels, amounts and due dates into student charges. A repeated enrollment is idempotent. Existing class/year enrollments cannot be replaced with another class; fee plans and posted charges have no editing/deletion endpoint.
- New-student creation auto-enrolls when a matching class plan exists for the current academic year. Students without a matching plan need explicit enrollment after configuration. Adding a plan does not silently bill all existing students.

## Payments, discounts and corrections

- Payments and discounts allocate to the oldest unpaid charges first, including previous academic years and then future installments. Overpayments and excessive discounts are rejected; unallocated credit is not supported yet.
- Discounts require an amount and reason, not approval. Actor and timestamp are recorded.
- Each payment stores amount, payment date, mode, optional transaction reference, school-specific sequential receipt number, recording staff identity and timestamp. Student name, admission number and school name are snapshotted so reprints retain original identity details.
- Receipts can be printed/reprinted. Reprinting never consumes a new receipt number.
- Incorrect payments are reversed with a reason; the original receipt and allocations remain, marked reversed, and stop reducing outstanding dues. A corrected payment gets a new receipt.
- Transactions run at serializable isolation with bounded retries. Database uniqueness constraints and submission fingerprints prevent duplicate payments/discounts and detect changed payloads reusing a submission key.
- Monetary writes have database positivity constraints. Money uses integer minor units with two decimal places and no floating-point calculations. Currency conversion is outside scope.

## Reports and audit

- Outstanding is all posted charges minus active payment allocations and discount allocations. Promotion never resets a balance.
- Overdue includes remaining balances with due dates before today's school date. Due today is still current. Reporting uses Asia/Kolkata as the initial school timezone.
- Reports show students with fees assigned, fully paid, up to date, overdue, remaining balances, net received collections, and discounts. Students without charges are shown separately from fully paid students.
- Reports are current-state, all-academic-year reports. Historical as-of balances, period collection filters and exports are not implemented yet.
- School setup, fee plans, enrollments, student changes, payments, discounts, reversals and staff grants create audit events in the same transaction. Application endpoints append audit events and do not provide audit editing/deletion. Production database privileges/backups must be configured before real records are used; a database superuser can alter data directly.

## Deferred scope

- Excel student/opening-dues import and export templates.
- Midyear class correction/proration, discount reversals, refunds, optional services and other exceptions.
- Fee-plan amendment/versioning UI. Current class/year plans are fixed after creation; do not use them with real data until configuration has been verified.
- Leaving/withdrawal clearance workflow, bulk promotion, notifications, and school timezone/currency settings UI.

Tests use synthetic records and disposable databases. No production data is imported or deleted by application features.
