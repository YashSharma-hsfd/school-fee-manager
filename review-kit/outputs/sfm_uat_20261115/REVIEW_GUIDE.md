# School Fee Manager: efficient manual review

Use the supplied CSV and workbook in a clean demo school. No checklist item is pre-marked Pass. Run the controlled money sequence before experimentation so differences have a clear cause.

## 1. Setup once

1. Apply migrations and start the app normally. Record the review date, reviewer/browser, app URL and git commit/build in the workbook. Stay on that build for the review round.
2. As your existing Admin create **Demo Review A**, code **UAT26A**, and **Demo Review B**, code **UAT26B**. B is for access-isolation tests. Use new suffixes if these codes already exist; do not delete/reset a school to repeat a review.
3. In A create academic years **2026-27** (2026-04-01 through 2027-03-31) and **2027-28** (2027-04-01 through 2028-03-31). Add classes **5A, 6A, 7A, 8A, 9A** exactly.
4. Create only the two fee plans needed initially: **5A / 2026-27** and **6A / 2027-28**. Both use annual Tuition **12000.00** and Activities **1200.00**, quarterly, first due **April 10** of the respective year. Total is **13200.00**, with four combined installments of **3300.00** (3000 Tuition + 300 Activities).
5. Create dedicated Accountant and Management test accounts in Configuration. Example email labels: `accountant.review@example.test` and `management.review@example.test`. Grant A only, with no configuration/access-management grants. Use your existing Admin. Choose passwords yourself and do not enter them in the review files.
6. Use **three separate browser profiles or different browsers** labeled Admin, Accountant and Management. Incognito windows in the same browser may share a session. Verify identity before each role test. Disable Grammarly on localhost if it produces the known body-attribute hydration warning.

Global roles select landing pages; school membership authorizes operations. Admin manages students/enrollment. Accountant records payments/discounts/reversals. Management is read-only by default. Fee configuration and access management are independent grants; the school creator receives both. Admin alone does not grant Accountant payment permission.

## 2. Import 50 synthetic students

In Review A open Import / promotion, select `dummy_students_50.csv`, preview and confirm once. **Use the CSV, not the review workbook.** Keep phone/admission columns as text if inspecting in Excel; do not overwrite the original import file. Native workbook import remains deferred.

All names are marked Demo. The numbers use the fictional +1 202 555 0100–0149 range. Do not contact them. There are no real student records or credentials in these files.

| Baseline | Expected |
|---|---:|
| Students | 50 Active |
| Classes represented | 5, ten students each |
| Admissions | UAT26-001 through UAT26-050 |
| Opening balances | 25 students |
| No charges yet | 25 students |
| Opening outstanding | 107500.00 |
| Collections / discounts | 0.00 / 0.00 |

Within each class, the first five students have zero opening due. The next five have 1000, 2500, 4000, 6000 and 8000, all due 2026-03-31: **21500 per class**. Import does not enroll students or assign annual fees. Reimporting into the same school must be rejected, leaving 50 records.

## 3. Follow this order

Only two students need enrollment for the core review; the other 48 supply search, pagination, opening-dues and no-fee coverage.

1. Complete SET-01 to SET-04 and ADM-01 to ADM-05. Enroll **001 and 002 only** into 5A/2026-27. Repeat the same enrollment for 001 to verify no duplicate charges.
2. As Accountant, complete ACC-01 through ACC-08. On **001 only**, record **1000 cash**, then **2000 bank transfer**, both dated on the actual review day. Apply **500 discount**. Print/save receipts, reverse the **2000 bank payment**, then reverse the **500 discount**. Keep the 1000 cash payment active.
3. As Admin with configuration permission, correct ONLY the **Tuition charge due 2027-01-10**, from **3000 to 2700**. Leave Activities at 300. The combined future installment becomes 3000. Do not change the annual fee plan.
4. Withdraw 001 with a reason. Inspect the account/receipts as Accountant without another payment. Reactivate 001. All money/history must remain.
5. Preview bulk promotion from 5A/2026-27 to 6A/2027-28. Select **001 only** and leave **002 unchecked**. Confirm; verify 002 remains in its source class/year.
6. Complete the FINAL checkpoint in Money checks and review dashboard/reports as Management.
7. Only after FINAL do ACC-09 (duplicate-click test on 003), ADM-10 (050 Inactive), staff/security tests, extra enrollments and other experiments. Additional payments change the baseline.

| Stage | 001 outstanding | Whole school outstanding | Active collections |
|---|---:|---:|---:|
| Import | 0.00 | 107500.00 | 0.00 |
| Enroll 001 and 002 | 13200.00 | 133900.00 | 0.00 |
| Pay 1000 cash | 12200.00 | 132900.00 | 1000.00 |
| Pay 2000 bank | 10200.00 | 130900.00 | 3000.00 |
| Discount 500 | 9700.00 | 130400.00 | 3000.00 |
| Reverse bank payment | 11700.00 | 132400.00 | 1000.00 |
| Reverse discount | 12200.00 | 132900.00 | 1000.00 |
| Correct future Tuition by -300 | 11900.00 | 132600.00 | 1000.00 |
| Withdraw / reactivate | 11900.00 | 132600.00 | 1000.00 |
| Promote ONLY 001 | 25100.00 | 145800.00 | 1000.00 |

Amounts use the app's two-decimal money units. Outstanding is independent of the test day. **Overdue is date-dependent.** At the kit's reference date **2026-11-15**, Asia/Kolkata, FINAL school overdue is **126300.00** and 001 overdue is **8900.00**. Charges due today are still current. January 2027 and next-year charges are future on that reference date. Recalculate overdue if testing after later due dates; do not flag those legitimate changes as bugs.

If both payments use your actual review day and no other payments were made in this fresh school, FINAL today/month collections are **1000.00**. Collection-date filters do not change current student balances. Historical as-of balances are deferred.

After FINAL, making 050 Inactive should produce **49 Active, 1 Inactive, 0 Withdrawn**, with its 8000 opening due still outstanding. Inactivation/withdrawal never cancels any charges, including future installments. Reactivation restores enrollment eligibility.

## 4. Role coverage

| Role | Review | Restriction to verify |
|---|---|---|
| Admin | Setup, import, search/contact edits, enrollment, lifecycle, selected promotion, charge correction with grant, staff access/recovery | Administration, payments, configuration and access management are separate permissions. |
| Accountant | Partial payments, validation, discounts/reversals, duplicate submission, receipt/PDF/reprint, old dues | No student administration or unrelated-school access. Withdrawn accounts can still pay retained dues. |
| Management | Dashboard totals, accounts/receipts, report dates, exports, audit filters | Read-only without deliberate independent grants. |

Paste copied restricted URLs while logged in as restricted staff. Hidden buttons alone do not prove server authorization. B must remain inaccessible to staff assigned only to A. Test configuration grants independently, then revoke/re-login. For password/recovery tests use a disposable staff account, not the only working administrator.

## 5. Document each check and finding

The workbook has three tabs:

- **Checklist:** 34 cases with steps/expected results. Enter Actual / evidence and choose Not tested, Pass, Fail or Blocked. Fail rows should link Issue IDs. Blocked means the check could not be performed; it is not a feature failure.
- **Feedback:** one issue per row. Fill role, school/student IDs, page, title, exact steps, expected/actual, evidence, frequency and an observable acceptance criterion. Keep IDs stable across review rounds. Preallocated IDs are not prefilled findings.
- **Money checks:** enter observed balances in blue columns; formula differences should be zero. Unentered observations remain blank rather than implying success.

Separate **Bug**, **UX**, **Feature request** and **Question**. Feature requests normally stay Deferred during the frozen MVP phase unless explicitly approved.

| Priority | Meaning |
|---|---|
| P0 | Wrong money, data loss or exposure across schools/roles; stop the affected flow and preserve evidence |
| P1 | Core work blocked with no usable workaround |
| P2 | Workaround exists or significant friction |
| P3 | Minor wording/spacing/cosmetic problem |

Use evidence names such as `ISSUE-001-step3.png`, `ISSUE-001-console.txt`, `ISSUE-001-receipt.pdf`. Capture exact error text and the related terminal request/error with time. Include browser/build details for intermittent issues. Do not include passwords, session cookies or environment-file secrets.

If filling a wide spreadsheet is inconvenient, send one copy of this text per issue:

```text
Issue ID / Case ID: ISSUE-001 / ACC-06
Type / priority: Bug / P0
Role / school / student: Accountant / Demo Review A / UAT26-001
Build / test date / browser:
Page / URL:
Starting state: outstanding 9700 after two payments and a 500 discount
Steps:
1. Open the BANK_TRANSFER receipt for 2000 (include receipt number).
2. Reverse it with reason UAT entry correction.
3. Reopen account and reports.
Expected: original marked reversed; outstanding 11700; active collections 1000.
Actual: [exact observation and numbers]
Frequency: [every time / intermittent / once]
Evidence: [file names and error text]
Acceptance criterion: [observable condition that makes this fixed]
```

The text above is a reporting example, **not an observed bug**. “Payments don't work” is insufficient without the student, amount, action and actual result. For UX, describe current steps and the clearer/shorter behavior you want.

## 6. Handoff and retest

Send the edited workbook plus evidence, and name the **top three Issue IDs** in your message. Note anything that prevented testing. I can triage, apply approved in-scope fixes, and report the IDs/checks affected. Retest the original steps on the new build and complete Retest result; close only when the acceptance criterion is met.

For a clean new round, create a newly coded demo school and reuse the CSV there. Same-school duplicate imports are intentionally blocked. Preserve earlier schools/receipts for reproduction rather than deleting/reusing history. Native Excel import, direct PDF downloads, refunds, automatic proration, fee-plan versioning and notifications remain outside this frozen MVP review. Manual review supplements the postponed automated browser tests before launch.
