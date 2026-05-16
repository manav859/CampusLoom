# Today 2 - Audit Fixes Changelog

Date: 2026-05-14

## 2026-05-15 Audit Sprint Additions



### Login Page

- Added password eye toggle.
- Fixed language toggle so English/Hindi copy changes on click.
- Implemented Forgot password flow with backend API.
- Fixed Next login runtime error by moving interactive login state into a client shell.

### Shared UI / Design Tokens

- Added shared UI primitives for button, modal, form controls, data table, dropdown menu, and toast.
- Added frontend design tokens for colors, typography, spacing, radius, shadows, focus rings, and Hindi font pairing.
- Refactored login UI to use shared primitives.

### Dashboard

- Added severity levels for action alerts.
- Replaced raw alert constants with readable labels.
- Added Send reminder action for defaulter rows.
- Wired dashboard defaulter reminder action to WhatsApp API.

### Audit Log Infrastructure

- Added Prisma `AuditLog` model and migration.
- Added backend audit-log helper.
- Added student create/update/activate/deactivate audit logging.
- Added visible student edit-history panel for principal/admin. ************edit button??

### Students List

- Added bulk-select and bulk actions:
  - Send WhatsApp
  - Promote class
  - Export CSV
  - Mark inactive
- Added sortable student table headers.
- Preserved parent-phone search and distinct pending-fee styling.

### Student Profile Header And Academic Tab

- Added 4px status-pill padding and 6px gap.
- Standardized KPI colors: green good, orange warning, red critical.
- Added Print profile and Share with parent actions.
- Added purple AI glyph beside Action insight.
- Added `How is this generated?` tooltip.
- Made duplicate exam names unique with date/sequence.
- Added exam comparison legend.
- Added inline student-vs-class comparison text.

### Homework Tab

- Rewired homework metrics to one assignment/submission source.
- Added pending count so on-time + late + missing + pending reconciles to total.
- Added class-average streak context.
- Added WhatsApp Nudge parent action for missing/not-submitted assignments.

### Register New Student

- Changed DOB input to `dd/mm/yyyy` with validation and ISO conversion for API.
- Replaced single guardian field with Father, Mother, and Other guardian sections.
- Captured guardian name, phone, and occupation.
- Added backend guardian fields, schema validation, Prisma migration, and API types.
- Added student photo upload on registration.
- Photo upload validates JPG/PNG up to 5MB and saves as student document type `PHOTO`.

## Attendance / Student List

- Updated backend student list enrichment in `backend/src/modules/students/students.service.ts`.
- Student rows now include real `lastPayment` when fee data is visible.
- Student rows now include attendance percentage from the shared attendance source-of-truth calculator.
- Added class-average attendance calculation for student profile attendance context.
- Added `classAverageAttendance` to frontend API types in `frontend/src/lib/api.ts`.
- Updated `frontend/src/app/(app)/students/[id]/_components/AttendanceTabPanel.tsx`:
  - Added class-average context in attendance metrics.
  - Added absent dates list below attendance calendar.
  - Added student-vs-class attendance context card.
- Checked off audit rows:
  - Populate Last Payment and Attendance columns.
  - Add search by parent phone.
  - Add absent dates list below calendar.
  - Add class-average attendance context.

## Fees / Payments

- Updated backend payment schema in `backend/src/modules/fees/fees.schemas.ts`.
- Added `sendReceiptOnWhatsApp` flag to payment input.
- Updated `backend/src/modules/fees/fees.service.ts` so receipt WhatsApp notifications are only queued when requested.
- Added `receiptNotificationQueued` to payment result.
- Updated frontend API payment payload/result types in `frontend/src/lib/api.ts`.
- Updated `frontend/src/components/fees/PaymentModal.tsx`:
  - Added payment date field, defaulting to today.
  - Allows backdated payments.
  - Added `Send receipt to parent on WhatsApp` checkbox, enabled by default.
  - Added balance-after-payment preview.
  - Shows receipt number as generated on save.
  - Added manual Send WhatsApp action after receipt creation.
- Updated `frontend/src/app/(app)/fees/[studentId]/page.tsx` notice copy to respect optional WhatsApp queueing.
- Updated `frontend/src/app/(app)/students/[id]/_components/FeesTabPanel.tsx`:
  - Receipt IDs are clickable.
  - Receipt rows can open PDF preview.
  - Receipt rows can send receipt on WhatsApp.
  - Added success/error notices for receipt actions.
- Checked off audit rows:
  - Add Date field with default today and backdating allowed.
  - Add `Send receipt to parent on WhatsApp` checkbox enabled by default.
  - Show running balance preview after payment.
  - Make receipt IDs clickable.
  - Open PDF receipt preview with school logo.
  - Add `Send to parent on WhatsApp` per receipt.

## Login Page

- Rebuilt `frontend/src/features/auth/LoginForm.tsx`.
- Added English/Hindi segmented language toggle.
- Added Forgot password mail link.
- Added support phone line.
- Applied stronger brand blue `#2456E6` on sign-in button.
- Added loading spinner inside sign-in button.
- Replaced broken mojibake loading ellipsis with plain `Signing in...`.
- Checked off audit rows:
  - Add Forgot password and language toggle on login.
  - Add Forgot password link below password field.
  - Add language toggle: English / Hindi.
  - Add support phone line.
  - Change sign-in button to stronger brand blue.
  - Add spinner inside sign-in button during loading state.

## Student Communication Tab

- Updated backend communication audit in `backend/src/modules/students/students.service.ts`.
- Notification-derived communication entries now include `recipientPhone`.
- Added optional `recipientPhone` to frontend API type.
- Rebuilt `frontend/src/app/(app)/students/[id]/_components/CommunicationTabPanel.tsx`:
  - Added empty CTAs for Send WhatsApp, Add manual note, Log a call.
  - Added channel filter chips: All, WhatsApp, Call, Manual.
  - Truncated long summaries in table/timeline.
  - Added full-message modal.
  - Added retry action for failed WhatsApp messages.
  - Added notices/errors for retry flow.
- Left WhatsApp Delivered/Read unchecked because current backend enum supports only queued/sent/failed.
- Checked off audit rows:
  - Add CTA inside empty tiles.
  - Add full-message expansion/modal for long summaries.
  - Add retry option for Failed.
  - Add channel filter chips.

## Student Behaviour Tab

- Updated `frontend/src/app/(app)/students/[id]/_components/BehaviourTabPanel.tsx`.
- Added consolidated empty state for no records.
- Added `Log behaviour entry` CTA.
- Added Minor/Major/Critical severity labels mapped from LOW/MEDIUM/HIGH.
- Added WhatsApp parent notify action for non-restricted behaviour entries.
- Added success/error notices for parent notifications.
- Added `id="behaviour-form"` to form for CTA anchor.
- Checked off audit rows:
  - Replace stacked empty states with one consolidated empty state.
  - Add `Log behaviour entry` button.
  - Add severity tags: Minor, Major, Critical.
  - Add `Notify parent via WhatsApp` on behaviour entries.

## Student Documents Tab

- Updated `frontend/src/app/(app)/students/[id]/_components/DocumentsTabPanel.tsx`.
- Grouped document counters to match dropdown categories:
  - Identity
  - Admission
  - Academic
  - Medical & agreements
- Added drag-and-drop upload zone.
- Added helper text: `PDF, JPG, PNG up to 5MB`.
- Added frontend validation for PDF/JPG/PNG and max 5MB.
- Added `Share with parent` toggle in upload form.
- Parent-share toggle is UI intent only; database has no persisted share flag yet.
- Checked off audit rows:
  - Expand document type dropdown for Indian admission needs.
  - Match top counters to document dropdown types.
  - Add drag-and-drop upload zone.
  - Add helper text.
  - Add `Share with parent` toggle for selected document types.

## Audit Checklist Updates

- Updated `AUDIT_CHANGES.md` after each completed slice.
- Only checked rows that were actually implemented.
- Intentionally left larger/incomplete rows unchecked, including:
  - WhatsApp statuses Delivered / Read.
  - Persisted document parent-share rules.
  - Larger audit-log infrastructure.
  - Broader component library refactor.

## Verification Run

- `backend npm run lint` passed after backend changes.
- `frontend npm run lint` passed after frontend changes.
- `backend npm run test:attendance` passed.
- `backend npx tsx tests/paymentReferences.test.ts` passed.
- `git diff --check` passed each time, with only existing CRLF warnings.

## Notes

- Worktree already had many modified and untracked files before these changes.
- No unrelated user changes were reverted.
- Some tests using `tsx` needed elevated execution because sandbox blocked esbuild child-process spawn with `EPERM`.
