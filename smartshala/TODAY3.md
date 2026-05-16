# TODAY3 - 2026-05-16


## Exams and marks

- Added `ExamTerm` support with Unit Test, Mid-Term, Final, Term 1, and Term 2.
- Added Prisma migration for exam terms.
- Required term/type when creating exams.
- Added teacher marks term dropdown.
- Grouped exam history by term.
- Standardized marks status text to sentence case.
- Added marks exam-term validation test.
- Added marks distribution histogram and at-risk side rail on the student academic tab.

## Attendance

- Added half-day attendance state support earlier in the sprint and kept attendance calculations aligned.
- Added reset confirmation modal on attendance.
- Added P/L/H/A labels and clearer control titles.
- Standardized save button placement/width and label behavior.
- Added reliable-attendance tooltip.
- Added daily attendance report filters: Today, Yesterday, This week, This month, Custom.
- Added nudge-pending-teachers action.
- Added CSV export and school metadata on report exports.
- Reframed attendance KPIs around marked scope.

## Settings and school profile

- Added school GSTIN, U-DISE number, affiliation board, and logo URL.
- Added settings backend module and routes.
- Added settings page save flow with logo upload and success toast.
- Surfaced school identifiers and logo in receipts/reports.

## Fees and receipts

- Expanded payment modes and mode-specific references.
- Added receipt PDF preview with school logo/details.
- Added WhatsApp receipt send action.
- Collapsed fee ledger KPI tiles into one summary card.
- Converted fee ledger statuses to sentence case.
- Consolidated empty payment state.
- Added real concessions and discounts:
  - New `FeeAdjustment` Prisma model and migration.
  - Backend create/apply adjustment API.
  - Ledger adjustment history.
  - Frontend Issue concession / Apply discount modal.
  - Validation test for adjustment schema.
- Added fee structure manager:
  - Edit existing fee structure.
  - Duplicate fee structure as inactive draft.
  - Archive fee structure.
  - Manage structures from fee command center.
- Added fee aging buckets: 0-30, 31-60, 61-90, 90+ days.
- Added tooltips for defaulter queue and WhatsApp receipt audit links.

## IA, reports, responsive, and shared UI

- Added automatic breadcrumbs through shared `PageHeader`.
- Made `PageHeader` action area more responsive.
- Changed Reports from redirect-only to a printable/exportable reports hub.
- Clarified Analytics as interactive risk insights, separate from Reports.
- Cleaned communication IA labels in sidebar: Comms hub and Message logs.
- Added academic year switcher in topbar with prior-year read-only indicator.
- Refactored the fees page to use shared `DataTable`, `Modal`, `Button`, `DropdownMenu`, `StatusPill`, and `PageHeader`.

## Audit checklist updates

- Checked completed High Priority items:
  - Refactor screens to use component library.
  - Confirm responsive layouts for top workflows.
- Checked completed Medium Priority items:
  - Clean IA.
  - Clarify Reports vs Analytics.
  - Fee structure editor.
  - Academic year switcher/read-only prior-year behavior.
- Checked completed Low Priority items:
  - Breadcrumbs on detail pages.
  - Marks distribution histogram and at-risk side rail.
- Checked related Fees Collection Command Center items:
  - Manage fee structures.
  - Edit/duplicate options.
  - Tooltips.
  - Aging buckets.

## Dashboard performance pass

- Reduced the principal dashboard from four startup API calls to one:
  - Removed separate dashboard-time calls for fee dashboard, defaulters, and WhatsApp logs.
  - Reused `feeSummary` and top defaulters returned by `/dashboard`.
- Added a short 15-second in-process backend cache for `/dashboard`, keyed by school, role, and user.
- Optimized attendance daily report:
  - Stopped loading full nested attendance records per class.
  - Switched to session lookup plus grouped status counts.
- Optimized risk summary:
  - Stopped loading every student's full attendance record and fee assignment arrays.
  - Switched to `groupBy` aggregates for attendance status counts and pending fee sums.
  - Avoided large `IN (...)` lists by using scoped relational filters.
- Trimmed dashboard prefetch work:
  - Admin prefetch now avoids duplicate fee/defaulter requests already covered by dashboard payload.
  - Kept skeleton/loading UI untouched.
- No UI layout, skeleton, or visible dashboard structure was removed.

