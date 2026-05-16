# TODAY3 - 2026-05-16

## Deployment/runtime

- Fixed the local `/dashboard` 500 caused by a stale mixed `.next` build that required missing chunk `./778.js`.
- Rebuilt the frontend and verified `/dashboard` returns `200`.
- Updated backend `npm start` to use the Render migration retry wrapper: `node scripts/render-start.mjs`.
- Kept `npm run start:server` for plain `node dist/server.js`.
- Render note: the service start command should be `npm start` or `npm run render:start`, not `npx prisma migrate deploy && npm start`, because the raw command bypasses the advisory-lock retry wrapper.

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

## Verification run

- `npm.cmd run prisma:generate --prefix backend`
- `npm.cmd run build --prefix backend`
- `npm.cmd run lint --prefix frontend`
- `npm.cmd run build --prefix frontend`
- `npm.cmd run test:fee-adjustment --prefix backend`
- Applied fee adjustment migration to the configured PostgreSQL database.
