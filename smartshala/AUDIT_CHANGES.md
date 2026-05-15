# SmartShala Website Audit Changes

Source audit: `d:\siteonlab\smartshala\audit.pdf`  
Audit date in file context: 2026 walkthrough/demo audit  
Overall audit score: 6.8 / 10  
Target score: 8.5 after one focused sprint

## AI.md Context And Instructions

Use this file as the implementation brief for the SmartShala audit. Any AI/model working on this repo should read this section first.

- [ ] Treat this as a product-quality checklist, not only a visual polish list.
- [ ] Preserve the current product architecture: SmartShala already has login, dashboard, students, teachers, classes, attendance, homework, marks, fees, communication, WhatsApp logs, and settings.
- [ ] Keep the strongest differentiator: WhatsApp-first workflows for Indian schools.
- [ ] Do not redesign the whole app unless requested. The audit says the bones are good; the surface, consistency, demo data, and Indian-context depth need work.
- [ ] Separate real product bugs from demo seed issues. The major real bug is student attendance source-of-truth mismatch. Demo data issues still matter because buyers see them.
- [ ] Follow the design tokens in this file when touching UI: no ad-hoc button colors, pill colors, KPI sizes, or table styles.
- [ ] Prefer shared utilities/components over one-off fixes: date formatting, currency formatting, KPI cards, pills, tables, modals, buttons, empty states, and attendance calculations.
- [ ] Add or update tests when fixing source-of-truth calculations, currency/date utilities, payment modes, attendance states, or grade bands.
- [ ] Keep Indian-school context in mind: UPI, cheque, DD, bank transfer, Hindi, Aadhaar/APAAR, U-DISE, GSTIN, WhatsApp, half-day attendance, sibling discount, fee installments.
- [ ] Make status text human-readable and localization-ready: use sentence case like `Paid`, `Marks entered`, `Payment receipt`; do not expose DB constants like `MARKS_ENTERED`.
- [ ] For each completed item, check it off only after UI, data, and verification are done.

## Audit Summary

- [ ] Raise product polish from 6.8 to about 8.5 with one sprint of focused fixes.
- [ ] Build a small design system and refactor inconsistent components into it.
- [ ] Fix one consistent metric layer so the same student/scope never shows conflicting attendance, homework, marks, or fee numbers.
- [ ] Refresh demo data so it looks like a real Indian school, not seed output.
- [ ] Add Indian-context gaps: payment modes, INR formatting, Hindi, document types, half-day attendance, and richer fee workflows.
- [ ] Confirm mobile/responsive behavior for top workflows because the audit did not include mobile screenshots.

## Keep These Product Strengths

- [ ] Keep WhatsApp as a first-class channel across logs, templates, reminders, receipts, and parent communication.
- [ ] Keep principal dashboard anatomy: KPI tiles, chart row, today's actions, recent events.
- [ ] Keep student profile tab structure: Academic, Homework, Attendance, Fees, Communication, Behaviour, Documents.
- [ ] Keep the `Action insight` concept and make it more explainable.
- [ ] Keep Fee Collection Command Center framing.
- [ ] Keep attendance calendar plus pattern detection.
- [ ] Keep receipt IDs and running balance in fee ledgers.
- [ ] Keep distinct principal and teacher role views.

## Design System Reference

### Colors

- [ ] `brand/primary`: `#2456E6` for primary buttons, active nav, links.
- [ ] `brand/secondary`: `#0F2557` for table headers and deep section titles.
- [ ] `brand/accent`: `#7C3AED` for AI / Action insight surfaces.
- [ ] `success/600`: `#0F8A4A` for Paid, Present, Active text.
- [ ] `success/100`: `#E1F5EA` for Paid pill backgrounds.
- [ ] `warning/600`: `#B95A00` for Pending, Late, Partial text.
- [ ] `warning/100`: `#FFF2DC` for Pending pill backgrounds.
- [ ] `danger/600`: `#C8242C` for Overdue, Absent, Critical text.
- [ ] `danger/100`: `#FCE3E5` for Overdue pill backgrounds.
- [ ] `info/600`: `#1F6FB8` for info banner text.
- [ ] `info/100`: `#E2F0FB` for info banner backgrounds.
- [ ] `ink/900`: `#0F1419` for headings and primary text.
- [ ] `ink/500`: `#5A6573` for labels and secondary text.
- [ ] `surface/50`: `#F7F8FB` for page backgrounds.
- [ ] `border/200`: `#DCE1E8` for borders, hairlines, dividers.

### Typography

- [ ] Use Inter as the primary family.
- [ ] Pair Hindi/Devanagari text with Hind, Mukta, or Tiro Devanagari Hindi.
- [ ] Give Devanagari about 10% more vertical breathing room.
- [ ] H1 page title: 24 / 32, weight 700.
- [ ] H2 section: 20 / 28, weight 600.
- [ ] H3 subhead: 16 / 24, weight 600.
- [ ] Body: 14 / 22, weight 400.
- [ ] Body strong: 14 / 22, weight 600.
- [ ] Caption: 12 / 16, weight 500.
- [ ] KPI number: 28 / 32, weight 700, tabular numbers.
- [ ] KPI label: 11 / 14, weight 600, uppercase, letter spacing 0.06em.
- [ ] Code / ID: 13 / 18, weight 500, mono for receipt IDs and admission numbers.

### Button States

- [ ] Primary default: background `#2456E6`, white text, 6px radius, 14px label, weight 600.
- [ ] Primary hover: background `#1B45BD`, white text.
- [ ] Primary active: background `#1638A0`, white text.
- [ ] Primary disabled: background `#C2C9D4`, text `#7A8390`, pointer events none.
- [ ] Primary focus: 2px ring, `#2456E6` at 40% opacity, offset 2px.
- [ ] Secondary: white background, text `#2A3340`, 1px border `#C2C9D4`.
- [ ] Destructive: background `#C8242C`, white text, always paired with confirm modal.
- [ ] Ghost/text: transparent background, text `#2456E6`, for tertiary table actions.

## Critical Priority

- [x] Fix the real attendance source-of-truth bug: Vijay Agarwal shows conflicting attendance across profile surfaces. Every student attendance percent must call the same query/function for the same period.
- [x] Add automated test coverage so two views of the same student cannot show different attendance for the same period.
- [x] Add fee payment modes: Cash, UPI, Cheque, DD, Bank Transfer, Online Gateway.
- [x] Add mode-specific payment reference fields: cheque number, UPI transaction ID, gateway transaction ID, bank reference.
- [x] Generate receipt PDF preview with school logo.
- [x] Add `Send on WhatsApp` for every receipt and ledger row.
- [x] Replace principal dashboard slider-like attendance chart with the teacher dashboard 7-bar plus smooth-line chart component.
- [x] Reframe school-wide `100% Attendance` metrics as scoped metrics like `Marked today: X% (Y of Z classes marked)`.
- [x] Build an INR currency utility with Indian grouping, Lakh/Crore formatting for >= INR 1L, and no paise on crore KPI figures.
- [x] Apply INR utility everywhere.
- [x] Add half-day attendance state and store it as 0.5 in the data model.

## High Priority

- [x] Refresh demo seed data: realistic names, phones, admission numbers, class sizes, marks, ranks, fee balances, dates, and locations.
- [x] Remove seed-data tells: `test` parent, `1234567890`, `.local` emails, repeated INR 49,466 balances, 367 days overdue, Pune/Ahmedabad mismatch.
- [x] Collapse multi-button table rows into one primary action plus overflow menu.
- [x] Build a component library for KPI card, table, pill, modal, form, button, empty state, dropdown, and toast.
- [ ] Refactor screens to use the component library.
- [x] Expand WhatsApp templates to at least: Attendance alert, Absence notification, Fee reminder, Exam announcement, PTM invite, Holiday notice, Generic notice, Birthday wish.
- [x] Add bilingual English + Hindi variants for WhatsApp templates.
- [x] Expand student document types: Aadhaar, Birth certificate, Caste certificate, Transfer certificate, Bonafide, Medical, Report card, Photo, Agreement.
- [x] Add bulk actions on Students: send WhatsApp, promote class, export CSV, mark inactive.
- [ ] Run accessibility pass: contrast, focus rings, severity icons, minimum body text size, colorblind-safe states.
- [x] Add P/A/L letters to attendance calendar cells, not color alone.
- [ ] Add immutable audit log infrastructure with visible `Edit history` on records.
- [ ] Confirm responsive layouts for Dashboard, Student Profile, Mark Attendance, Send Communication, Record Payment.
- [x] Clarify partial payment display as one line: `Paid INR X of INR Y - INR Z still pending`.

## Medium Priority

- [x] Standardize date display to `dd MMM yyyy` using one date utility. Keep ISO only in data attributes.
- [ ] Add exam term/type field: Unit Test, Mid-Term, Final, Term 1, Term 2.
- [ ] Group exam history by term.
- [x] Create reusable empty-state component with illustration, headline, supporting copy, and one primary CTA.
- [ ] Start Hindi locale pass with i18n strings and Devanagari font pairing.
- [ ] Clean IA: merge Communication / WhatsApp Logs / Templates where appropriate.
- [ ] Clarify Reports vs Analytics: printable/exportable reports vs interactive insights.
- [ ] Add fee structure editor with list, create, edit, duplicate, archive.
- [ ] Add academic year switcher and read-only prior-year behavior.
- [x] Replace 0% bars for unmarked classes with `Not marked`.

## Low Priority

- [x] Convert all status pills from uppercase/DB constants to sentence case.
- [x] Add initials-avatar component for students and teachers.
- [ ] Add breadcrumbs on detail pages.
- [ ] Add GSTIN, U-DISE number, and affiliation board on School profile.
- [ ] Surface GSTIN/U-DISE/board details on receipts and reports where useful.
- [ ] Add marks distribution view with histogram and at-risk side rail.
- [x] Fix grade band mapping so 0% maps to F or ABS, not D.

## Quick Wins

- [x] Demo seed cleanup.
- [x] INR currency utility with Lakh/Crore and Indian grouping.
- [x] Sentence-case all status pills.
- [x] Initials-avatar component on Students and Teachers lists.
- [x] Collapse multi-button rows into overflow menu on Students table.
- [x] Fix grade band logic.
- [x] Standardize date format across the product.
- [x] Mask middle digits of phone numbers in WhatsApp Logs.
- [x] Add confirmation modal on destructive actions.
- [x] Add reusable empty state to remaining views: Exams list, Teacher logs, Recent incidents.
- [x] Replace principal attendance chart with teacher dashboard chart component.
- [x] Standardize KPI tile label sizes and weights.
- [x] Add tooltips on KPIs explaining formulas.
- [x] Add `Forgot password` and language toggle on login.

## Medium Effort Work

- [x] Build color, typography, spacing, radius, and shadow tokens as code variables.
- [ ] Refactor shared UI into component library.
- [ ] Reconcile every visible metric to one source-of-truth query and add tests.
- [ ] Implement expanded payment modes, reference capture, and PDF receipts.
- [x] Expand WhatsApp templates with bilingual variants and variable preview.
- [ ] Expand student documents.
- [ ] Add half-day attendance, leave flow, and absent reason capture.
- [ ] Add Students bulk-action system.
- [ ] Add audit log infrastructure.
- [ ] Complete accessibility pass.
- [ ] Add Hindi locale pass.
- [ ] Build mobile/responsive layouts for top five workflows.

## Long-Term Work

- [ ] Add multi-installment fee plans.
- [ ] Add concession and scholarship workflows.
- [ ] Add exam report-card generation.
- [ ] Add timetable/period schedule view per class and teacher.
- [ ] Add end-of-year batch promotion/graduation workflow.
- [ ] Add principal approval queue for fee reversals, mark corrections, and transfer certificates.
- [ ] Productize AI / Action insight with consistent branding and explainability.
- [ ] Add offline Mark Attendance with sync-on-reconnect.
- [ ] Add SMS fallback for parents without WhatsApp.
- [ ] Add multi-tenant school selector and per-school receipt branding.
- [ ] Integrate payment gateway such as Razorpay/Cashfree.
- [ ] Integrate accounting such as Tally/Zoho.
- [ ] Integrate SMS gateway.
- [ ] Consider parent app for fee payment, report card, and leave application.

## Screen-By-Screen Checklist

### Login Page

- [x] Add `Forgot password` link below password field.
- [x] Add language toggle: English / Hindi.
- [x] Add support phone line: `Trouble signing in? Call +91-XXXX`.
- [x] Change sign-in button to stronger brand blue `#2456E6`.
- [x] Add spinner inside sign-in button during loading state.
- [ ] Optional: add staff phone OTP sign-in.
- [ ] Plan school code or subdomain field for multi-school SaaS.

### Principal Dashboard / Homepage

- [x] Replace misleading `100% Attendance` KPI with scoped marked-today copy.
- [x] Add KPI formula tooltip for every tile.
- [x] Replace slider-looking attendance chart with standard 7-bar plus line chart.
- [x] Make KPI tiles clickable and link them to underlying lists.
- [x] Add `School pulse` sentence under title.
- [x] Add quick actions: Mark today's attendance, Send fee reminder, Add student, Record payment.
- [x] Label fee donut with time window.
- [x] Clarify AI Alerts tile click behavior.
- [x] Add time-window context to Defaulters tile.

### Today's Actions And Recent Events

- [ ] Add severity levels: critical red, high orange, medium yellow.
- [x] Replace raw labels like `LOW_ATTENDANCE` with plain English.
- [x] Vary defaulter amounts in demo data.
- [x] Fix implausible 367-day overdue demo data.
- [ ] Sort recent events by importance or split into `Needs action` and `Recently happened`.
- [ ] Add `Send reminder` button on defaulter rows.

### Students List

- [x] Keep only `View` inline.
- [x] Move `Resend` and `Deactivate` into overflow menu.
- [x] Populate Last Payment and Attendance columns or remove them.
- [x] Add bulk-select and bulk actions.
- [ ] Make column headers sortable.
- [x] Add search by parent phone.
- [x] Make pending amount visually distinct from INR 0.
- [x] Clarify status filter options.

### Register New Student Form

- [ ] Use `dd/mm/yyyy` date picker for date of birth.
- [ ] Replace single guardian field with Mother, Father, Other Guardian sections.
- [ ] Capture guardian name, phone, and occupation.
- [ ] Add student photo upload.
- [x] Mark required fields with red asterisk.
- [x] Add Aadhaar / APAAR ID field.
- [x] Add Previous School field.
- [x] Add sibling-discount checkbox.

### Student Profile Header And Academic Tab

- [x] Clean demo data: real parent names, realistic phone numbers, plausible admission numbers.
- [ ] Add spacing around status pills: 4px padding, 6px gap.
- [ ] Standardize KPI color logic: green good, orange warning, red critical.
- [ ] Add purple AI glyph next to Action insight.
- [ ] Add `How is this generated?` tooltip for Action insight.
- [ ] Add `Print profile` / `Share with parent` button.

### Student Profile Academic Deep Dive

- [x] Fix student attendance source of truth across top tile, header, academic, attendance, and homework tabs.
- [x] Add test that fails when same student/period has conflicting attendance values.
- [x] Fix grade band: 0% should be F or ABS.
- [x] Define grade bands explicitly in code.
- [ ] Make duplicate exam names unique with date or sequence.
- [x] Replace confusing partial fee labels with one clear line.
- [ ] Seed realistic class averages and ranks.

### Student Profile Exam Comparison

- [ ] Seed realistic marks distribution.
- [ ] Add legend to exam comparison chart.
- [ ] Wire homework completion numbers to one source.
- [ ] Add inline comparison: `You are X% below class average`.

### Student Profile Homework Tab

- [ ] Reconcile submitted/late/missing/streak numbers with subject completion percent.
- [ ] Add `Class average streak` context line.
- [ ] Support homework file attachments.
- [ ] Allow teachers to upload graded work back.
- [ ] Add `Nudge parent on WhatsApp` for not submitted assignments.

### Student Profile Attendance Tab

- [x] Match top attendance tile calculation to attendance tab calculation.
- [x] Tone AI message to `No weekly pattern detected` when appropriate.
- [x] Add P/A/L letter inside each calendar cell.
- [x] Add absent dates list below calendar.
- [x] Add class-average attendance context.

### Student Profile Fees Tab

- [ ] Add UPI, Bank Transfer, Cheque, DD, Online Gateway modes.
- [ ] Add transaction/reference details per mode.
- [x] Make receipt IDs clickable.
- [x] Open PDF receipt preview with school logo.
- [x] Add `Send to parent on WhatsApp` per receipt.
- [x] Convert status pills to sentence case.

### Student Profile Communication Tab

- [x] Add CTA inside empty tiles: `Log a call`, `Add manual note`.
- [x] Add full-message expansion/modal for long summaries.
- [ ] Use WhatsApp statuses: Sent, Delivered, Read, Failed.
- [x] Add retry option for Failed.
- [x] Add channel filter chips: All, WhatsApp, Call, Manual.

### Student Profile Behaviour Tab

- [x] Replace stacked empty states with one consolidated empty state.
- [x] Add `Log behaviour entry` button.
- [x] Remove confusing `0 used` pill.
- [x] Add severity tags: Minor, Major, Critical.
- [x] Add `Notify parent via WhatsApp` on behaviour entries.

### Student Profile Documents Tab

- [x] Expand document type dropdown for Indian admission needs.
- [x] Match top counters to document dropdown types.
- [x] Add drag-and-drop upload zone.
- [x] Add helper text: `PDF, JPG, PNG up to 5MB`.
- [x] Add `Share with parent` toggle for selected document types.

### Teachers List

- [x] Move `Deactivate` into overflow menu.
- [x] Keep `Manage` as primary inline button.
- [x] Add initials avatars on teacher rows.
- [ ] Make number of periods configurable per school.
- [x] Replace `.local` demo emails with realistic school emails.
- [x] Add filters by class teacher, subject taught, and status.

### Manage Classes And Subjects Modal

- [ ] Hide or disable subject dropdown when `Free period` is selected.
- [ ] Add day-of-week tabs.
- [ ] Make period count configurable from Settings.
- [ ] Add conflict detection for teacher/class/period collisions.
- [ ] Add `Copy from another day`.
- [ ] Add `Repeat for all weekdays`.

### Classes Grid

- [x] Vary class strengths in demo data.
- [x] Move trash/delete into overflow menu.
- [x] Add confirmation modal before class delete.
- [x] Drop `Active` badge unless inactive/archived states exist.
- [ ] Group cards by level or add colored stripe.
- [ ] Add quick actions: Mark attendance, Send notice, View roster.

### Create New Class Form

- [ ] Make Class Teacher required.
- [ ] Add Subjects multi-select.
- [ ] Add Maximum strength.
- [ ] Add Stream for higher classes.
- [ ] Add Medium of instruction.
- [ ] Allow academic year editing for archival use.

### Class Roster

- [ ] Fix header/list mismatch: 30 Students vs 29 listed.
- [ ] Replace `View Profile` with row menu: View, Message, Mark attendance.
- [ ] Add stats row: class attendance, marks average, fee collection percent.
- [ ] Investigate roll numbers not starting at 1.
- [ ] Add `Print class list with photos`.

### Reliable Attendance Main View

- [ ] Make Save button normal width, about 200-240px.
- [ ] Place Save button right-aligned in sticky bottom bar.
- [ ] Add confirmation modal on `Reset all present`.
- [ ] Add tooltip explaining `Reliable attendance`.
- [x] Add P/A/L letters inside calendar cells.
- [x] Add Half day option.

### Attendance Class Selector

- [ ] Add search inside class dropdown.
- [ ] Group classes by Primary, Middle, Secondary.
- [ ] Remember last selected class per teacher.

### Attendance Per-Student Controls

- [x] Drop or rename `Cycle status` to `Today's status`.
- [ ] Standardize dates to `dd MMM yyyy`.
- [ ] Add first-use tooltip for P/L/A controls.
- [ ] Use one save button label across save states.
- [ ] Show `Saved - 9:45 AM` when saved.
- [ ] Add absent reason: Sick, Family, Other, Unexcused.

### Homework Create Assignment

- [ ] Add multiple file upload for PDF/JPG/PNG up to 10MB each.
- [ ] Make Subject required.
- [ ] Remove `General` as lazy default.
- [ ] Increase description textarea height.
- [ ] Add basic formatting in description.
- [ ] Add estimated time field.
- [ ] Add rubric or answer key attachment field.

### Homework Assignment List

- [ ] Show overdue age like `Overdue - 3 days`.
- [ ] Vary overdue severity by age.
- [ ] Add `Nudge non-submitters on WhatsApp`.
- [ ] Make `View Students` secondary outlined button.
- [ ] Add filters: Overdue, Due soon, Closed.

### Homework Submission Tracking

- [ ] Replace three solid status buttons with segmented control.
- [ ] Remove duplicate status pill/action repetition.
- [ ] Auto-save marks on blur or add one `Save all` button.
- [ ] Use row-specific note placeholder.
- [ ] Show class-average marks after saving.
- [ ] Add progress bar like `1 of 31 submitted - 3% complete`.
- [ ] Drop duplicate class info in tracking header.

### Exam And Marks

- [x] Change `MARKS_ENTERED` to `Marks entered`.
- [ ] Seed plausible class averages.
- [ ] Add Term/Type dropdown while creating exam.
- [ ] Group exam history by term.
- [ ] Add `Lock after submit` with principal override.

### Communication / Parent Communication

- [ ] Build unified template library.
- [x] Resolve template variables in preview pane.
- [x] Truncate log previews to one line.
- [ ] Add `View full` link for messages.
- [ ] Add scheduled send date/time picker.
- [x] Add bilingual template variants.

### Daily Attendance Report

- [x] Reframe attendance KPI with scope: `100% in 1 marked class - 24 still pending`.
- [x] Or split into `Marked classes` and `Average attendance (marked only)`.
- [ ] Add `Nudge teachers` for pending classes.
- [ ] Add date filter: Today, Yesterday, This week, This month, Custom.
- [x] Replace 0% bars for unmarked classes with `Not marked`.
- [ ] Add Export to PDF / CSV.

### Fees Collection Command Center

- [x] Round currency to nearest rupee in KPI tiles.
- [x] Format INR >= 1,00,000 as Lakh/Crore.
- [x] Standardize INR prefix and Indian grouping.
- [x] Vary demo defaulter amounts.
- [ ] Make `Create Fee Structure` open/manage existing structures.
- [ ] Add edit/duplicate options for fee structures.
- [ ] Add tooltips for defaulter follow-up queue and WhatsApp receipts.
- [ ] Add aging buckets: 0-30, 31-60, 61-90, 90+ days.

### Fee Ledger

- [ ] Collapse redundant four tiles into one summary card.
- [ ] Use sentence case for status pill.
- [ ] Show one consolidated empty state, not two.
- [ ] Add `Generate invoice`.
- [ ] Add `Issue concession`.
- [ ] Add `Apply discount`.
- [ ] Add year-on-year fee history.

### Record Payment Modal

- [x] Add payment modes beyond Cash.
- [x] Add mode-specific reference fields.
- [x] Add Date field with default today and backdating allowed.
- [ ] Show next receipt number before recording.
- [x] Add `Send receipt to parent on WhatsApp` checkbox enabled by default.
- [x] Show running balance preview after payment.

### Analytics / Risk Insights

- [ ] Add trend arrows and comparison, e.g. `8 up +2 vs last week`.
- [ ] Add LOW severity tag and counts for all severity levels.
- [ ] Make priority student rows actionable: Message parent, View profile, Mark resolved.
- [ ] Add `Why is this student at risk?` explainer with data breakdown.
- [ ] Add Export CSV.
- [ ] Add bulk WhatsApp message to priority parents.

### WhatsApp Logs

- [ ] Seed plausible message volume: 80-150 sends/day.
- [ ] Use real statuses: Sent, Delivered, Read, Failed.
- [ ] Show retry on Failed.
- [x] Mask phone middle digits.
- [ ] Add credits remaining tile.
- [x] Truncate message previews at about 80 characters.
- [ ] Add expand/full-message view.
- [ ] Expand type filter to match actual data types.
- [x] Convert all-caps message types to sentence case.
- [ ] Match filter dropdown widths.

### Settings

- [x] Fix Pune vs Ahmedabad location mismatch.
- [x] Add WhatsApp templates: Fee reminder, Exam announcement, PTM invite, Holiday notice, Generic notice, Birthday wish.
- [x] Add bilingual template support.
- [ ] Plan Settings IA: School profile, Academic year, Holiday calendar, Grading bands, Fee categories, User roles, WhatsApp templates, Branding, Integrations, Backup.
- [ ] Show success toast on save.
- [ ] Add school logo upload.
- [ ] Add GSTIN.
- [ ] Add U-DISE number.
- [ ] Add affiliation board: CBSE, ICSE, State.

### Teacher Dashboard

- [ ] Standardize all attendance charts to teacher dashboard version.
- [ ] Replace teacher `Defaulters` tile with `Pending homework submissions` or `Unmarked attendance days`.
- [ ] Add scope labels: `Your students` vs `School-wide`.
- [ ] Add time window selector on donuts.

### Teacher Today's Actions And Classes Grid

- [ ] Keep orange severity pattern and extend it to other action types.
- [ ] Style subject chips with subtle gray background and consistent shape.
- [ ] Reconcile academic year mismatch.
- [ ] Add class-card quick actions: Mark attendance, Assign homework, View roster.

### Teacher Homework, Marks, Communication

- [ ] Show clearer empty state when no subjects are assigned.
- [ ] Apply homework file-upload and assignment fixes to teacher role.
- [ ] Add inline analytics column with class-average marks per assignment.
- [ ] Share same template library between principal and teacher communication.
- [ ] Add pagination and filters to teacher communication log.
- [ ] Add teacher quick templates: Homework reminder, Class cancelled, PTM invite, Sick child sent home.

### Teacher Attendance And Students

- [ ] Apply attendance fixes to teacher attendance screens.
- [ ] Add `My classes today` status strip showing marked/unmarked classes.
- [ ] Move `Attendance loaded` toast to top-right and auto-dismiss after 3 seconds.
- [ ] Populate teacher students Attendance column.
- [ ] Add inline actions: View, Message, Quick mark.
- [ ] Add `My current period` filter chip based on timetable.

## Open Questions To Clarify

- [ ] Is mobile responsive work in scope now or later?
- [ ] Are parents WhatsApp-only, or is there parent web/app UI?
- [ ] Is SmartShala single-tenant per school or multi-school SaaS?
- [ ] Are Action insight paragraphs LLM-generated, rule-based, or static demo copy?
- [ ] What should global header search return?
- [ ] What does the notification badge surface?
- [ ] Are accountant, front-office staff, librarian, transport coordinator roles in scope?
- [ ] Are U-DISE/state-board compliance exports in scope?
- [ ] Is hosting cloud or on-premise?
- [ ] Is pricing aimed at budget ERP, mid-tier private schools, or premium/international schools?
