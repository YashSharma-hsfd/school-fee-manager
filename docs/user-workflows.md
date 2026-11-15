# User workflows

## Shared workspace

After sign-in, choose a school or continue in the currently selected school. The workspace header identifies the school, signed-in name and school-specific role. All schools switches context; Your password and Sign out stay available. The active navigation item is highlighted.

Overview contains the role's next steps and school totals. Student accounts opens a dedicated search page without the dashboard above it. Reports & audit opens filters, exports and history. Administration additionally sees Student records and Import & promotion. Configuration appears only for explicit fee-configuration or access-management grants. Server authorization remains the authority for all actions.

## Administration

1. Select the school and confirm the Administration badge.
2. If granted configuration access, open Configuration and use Years & classes, then Fee plans. Verify a plan before assigning it. If not granted, ask the school's fee configurator to prepare the plan.
3. Choose Manage students / Student records to add or edit admissions and contacts. Import & promotion is available for CSV import or selected bulk promotion.
4. Find an account by student name, admission, guardian name/phone, class and lifecycle status. Confirm the identity and contacts displayed on the account.
5. Use Enroll / promote for individual academic-year assignments. Previous dues remain. Use the status panel for audited inactivation, withdrawal or reactivation; status changes do not cancel charges.
6. With the configuration grant, correct individual charges through Charges and due dates. Existing settlement limits still apply.
7. With access-management permission, assign existing staff to the school. Global administrators with that grant can also create/recover eligible staff accounts after reauthentication. Payment recording remains an Accountant operation.

## Accountant

1. The Accountant landing page lists assigned schools directly. Open the required school and confirm its role badge.
2. Choose Find student / collect payment or Student accounts. Search by name, admission, guardian phone/name, class and status.
3. Open View account. Confirm the student, guardian, class, lifecycle status and current outstanding amount.
4. Choose Collect payment to jump to Record payment. Enter the amount actually received, actual payment date, mode and reference, then Record payment & issue receipt. Existing server validation and duplicate-submission protection are unchanged.
5. Check the issued receipt, choose Print receipt, and use the print dialog's Save as PDF when required. Reprints retain the same number.
6. Choose Collect next payment to return to student search, or Back to student account for this student's history.
7. Review overdue accounts and Reports & audit to reconcile collections. Use Net collections for active receipts, and transaction history/export for originals, discounts and reversal events.

An account with no assigned charges explains that administration must enroll the student first. A fully paid account points to existing receipts. Inactive/withdrawn accounts retain payment and receipt access for their remaining dues. Existing discount and reversal flows stay available; they require reasons and retain history. A reversal corrects a recorded entry and is not a refund workflow.

## Management

1. Open the selected school and confirm the Management badge.
2. Review Overview totals and use a metric's View details link to inspect the underlying report or student list.
3. Use Student accounts to find a student and inspect contacts, charges, academic history, payments and receipts. Account task links navigate to those sections; payment/enrollment controls are absent.
4. Open Reports & audit. Apply student search, class, lifecycle, financial status, dates and mode as appropriate. Financial status applies only to balances; dates/mode apply to collections/history. Class/lifecycle refer to current student records.
5. Download filtered balances, overdue accounts, net collections, or full matching transaction history. Signed cash/discount columns reconcile reversals; absolute event amounts are not net totals.
6. Review audit events by staff/action/date/record. This workspace is read-only by default; separate configuration grants do not grant payment or student-administration permissions.

## UI review before launch

On each role, verify the school badge and active navigation; open Student accounts, search the same synthetic student, and verify permitted account task links. Complete the Accountant receipt-to-next-student loop. Check narrow-screen navigation and print/PDF output. Confirm restricted pages remain protected when accessed directly.

Role-navigation unit tests and browser scenarios cover these paths. Browser scenarios have been added but remain deferred/unrun until explicitly resumed. No UI walkthrough alone establishes that all production/browser flows have passed.
