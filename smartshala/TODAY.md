# SmartShala - Today Log

Date: 2026-05-14  
Updated at: 2026-05-14 13:12:58 +05:30

## What We Completed Today

This file lists only the work completed today during this session.

## 1. Attendance source-of-truth and half-day support

- Fixed the attendance source-of-truth mismatch across student profile surfaces so the same student and period no longer show conflicting attendance numbers.
- Added `HALF_DAY` to the attendance status model.
- Added `attendanceValue` to attendance records and stored half-day as `0.5`.
- Updated attendance calculations so:
  - `PRESENT` = `1`
  - `LATE` = `1`
  - `HALF_DAY` = `0.5`
  - `ABSENT` = `0`
- Updated monthly and daily attendance summaries to use weighted attendance instead of simple status counts.
- Renamed `Cycle status` to `Today's status` in attendance UI.
- Added P/A/L markers in calendar cells and included half-day handling in attendance displays.
- Updated class and student attendance reports to include `halfDay` and `attended` values.

## 2. Fee payment modes, payment references, receipts, and WhatsApp 
   **need to record payment 2-3 times to make successfully
- Expanded payment modes to support:
  - `Cash`
  - `UPI`
  - `Cheque`
  - `DD`
  - `Bank Transfer`
  - `Online Gateway`
- Added mode-specific payment reference fields:
  - `upiTransactionId`
  - `chequeNumber`
  - `ddNumber`
  - `gatewayTransactionId`
  - `bankReference`
- Added backend validation so the correct reference field is required for the selected payment mode.
- Added receipt PDF preview support.
- Updated receipt PDF to include school branding/logo treatment and payment reference details.
- Added `Send on WhatsApp` support for receipts and ledger entries.
- Added frontend actions for:
  - preview PDF
  - download PDF
  - send receipt on WhatsApp
- Updated fee ledger rendering to show reference information.
- Clarified partial payment display to show paid amount, total amount, and remaining pending amount on one line.



## 3. Demo seed data cleanup and realism pass

- Rewrote the seed data to look like a real Indian school demo instead of obvious generated data.
- Replaced fake/low-quality demo patterns such as:
  - `.local` emails
  - repeated or implausible phone numbers
  - `Parent of ...` parent names
  - location mismatch between Pune and Ahmedabad
  - repeated fee balance patterns
  - implausible long-overdue dates
- Updated demo school identity to:
  - `SmartShala Ahmedabad Public School`
  - Ahmedabad, Gujarat
- Added more realistic:
  - teacher accounts
  - student names
  - parent names
  - phone numbers
  - addresses
  - admission numbers
  - class sizes
  - fee amounts
  - paid/pending fee scenarios
  - payment references
  - attendance records
  - marks and exam results
- Added realistic exam results and rank-friendly marks data to improve academic demo quality.
- Fixed seed cleanup order to avoid foreign key issues.
- Updated settings and topbar to match Ahmedabad branding.

## 4. WhatsApp template library and bilingual variants

- Expanded communication template coverage to include:
  - Attendance alert
  - Absence notification
  - Fee reminder
  - Exam announcement
  - PTM invite
  - Holiday notice
  - Generic notice
  - Birthday wish
  - Homework reminder
- Added bilingual English + Hindi variants for templates.
- Added shared frontend template rendering utility with placeholder substitution.
- Added live template preview with sample variables.
- Updated teacher communication screen with:
  - template picker
  - language toggle
  - rendered preview
- Updated settings page to show template library previews.
- Extended backend communication enum values to support the new template types.
- Mapped relevant message types to notification kinds for backend logging and delivery metadata.


## 5. Dashboard KPI visibility, tooltips, and resilience

- Fixed dashboard KPI cards not showing when dashboard API failed.
- Root cause found during session:
  - pending database migrations caused dashboard queries to read columns that did not yet exist in the database
  - this broke `/dashboard` and left KPI cards empty
- Applied pending Prisma migrations to the database.
- Added frontend fallback behavior so KPI card area still renders instead of collapsing completely during temporary dashboard loading/API issues.
- Added KPI formula tooltips using a visible `?` indicator and `title` text.
- Added formulas for the main dashboard KPI cards:
  - Students
  - Marked today / Pending attendance
  - Defaulters
  - Collected
  - AI Alerts
- Smoke-tested dashboard service directly against the backend and confirmed it returned KPI data successfully.


## 8. Audit checklist updates made today

- Checked off items in `AUDIT_CHANGES.md` that were actually completed today, including:
  - half-day attendance
  - payment mode/reference work
  - receipt preview / WhatsApp send
  - seed cleanup
  - WhatsApp template expansion
  - bilingual template support
  - KPI formula tooltips
  - Pune/Ahmedabad mismatch fix
  - class strength and defaulter demo data fixes
