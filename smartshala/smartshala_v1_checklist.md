# SmartShala V1 Completion Checklist

## Phase 0 — Core Management
- [x] Student creation workflow (auto-admission, fee assignment)
- [x] Teacher creation workflow
- [x] Class creation workflow
- [x] Class detailed view (roster + KPIs)

## Phase 1 — WhatsApp Core
- [x] Setup WhatsApp service (API integration or mock)
- [x] Implement send single message API
- [x] Implement bulk messaging API
- [x] Create message templates (absence, fee reminder, receipt)
- [x] Trigger WhatsApp on attendance (absent students)
- [x] Store notification logs in DB
- [x] Verify delivery status handling

## Phase 2 — Fees Core System
- [x] Create fee structure (class-wise, term-wise, due dates)
- [x] Implement student fee ledger (total, paid, balance)
- [x] Build payment recording API
- [x] Update ledger after payment
- [x] Generate receipt number
- [x] Generate PDF receipt
- [x] Send receipt via WhatsApp
- [x] Implement defaulter list API
- [x] Build basic fees UI (ledger + payment screen)

## Phase 3 — Automation Layer
- [ ] Implement fee reminder scheduler (cron/job)
- [ ] Send reminders (7 days before, due day, overdue)
- [ ] Build defaulter detection logic
- [ ] Add attendance alerts (<75%)
- [ ] Add class-level alerts (low attendance)
- [ ] Implement bulk WhatsApp reminders

## Phase 4 — Reports Completion
- [ ] Add PDF export for reports
- [ ] Build monthly attendance reports
- [ ] Build fee reports (collection vs target)
- [ ] Build defaulter report export
- [ ] Complete dashboard KPI cards
- [ ] Combine attendance + fees insights3   

## Phase 5 — Basic AI (Rule-Based)
- [ ] Implement at-risk student scoring
- [ ] Combine attendance + fees signals
- [ ] Create alert system (red/amber/green)
- [ ] Show insights on dashboard
- [ ] Add simple recommendations (call parent, send WA)

---

## Notes
- Follow order: Phase 1 → Phase 5
- Do not skip dependencies
- Validate each phase before moving forward
- Attendance absence WhatsApp currently uses a mock sender and persists logs in the existing `notifications` table.
- Fees backend now supports class-wise structures, class assignment, ledgers, transactional payments, receipt numbers, defaulters, and mock WhatsApp receipts.
- Phase 1 and Phase 2 frontend screens now cover dashboard KPIs, WhatsApp logs, fees dashboard, defaulters, student ledger, and payment modal.
- 2026-04-23: Upgraded the App Router frontend shell and core ERP pages to a premium glassmorphism UI system without changing backend code, API calls, or business logic.
- 2026-04-30: Added "Show Inactive" toggle and activation functionality for students and teachers to allow restoring deactivated users.
- 2026-04-30: Implemented full PDF receipt generation pipeline — payment → ledger update → auto-numbered receipt → PDF generation (pdfkit) → auto-download → WhatsApp with balance info in 10s. Supports partial payments (PARTIAL status) and shows remaining balance.
- 2026-04-30: Fixed Render cold-start issue ("Something went wrong" on first request) by implementing global DB warmup middleware, automatic reconnection logic, and transaction retries for critical operations.
- 2026-05-01: Modularized the student detail page into a dashboard shell with a sticky header, KPI section, lazy-loaded tabs, Academic profile/insight content, and Fees assignments content while preserving existing client-side data fetching.
- 2026-05-01: Upgraded the student profile header to the SmartShala snapshot standard with performance rate, status pills, quick stats, parent contact actions, and backend-provided rank/attendance/fee/absence metrics.
- 2026-05-01: Implemented the unified performance metric using exam average, homework completion, and attendance percentage with performance-based classification and legacy risk fallback where academic inputs are not yet available.
- 2026-05-01: Built the Academic tab analytics layer with Exam and Subject models, exam rows with class average/rank, Recharts trend and radar charts, and homework completion by subject.
- 2026-05-01: Implemented homework tracking with assignment/submission models, on-time completion intelligence, status counts, subject breakdown, streaks, and a full Homework tab assignment log.
- 2026-05-01: Upgraded attendance into a visual pattern-based system with monthly calendar status mapping, CBSE warning below 80%, 75% cushion metrics, attendance records, and repeated weekday absence detection.
- 2026-05-02: Upgraded fees into an accountant-grade ledger with backend running balances, per-payment transaction rows, receipt IDs, balance-after values, and payment timeline views while preserving fee assignments and partial payment support.
- 2026-05-02: Implemented the communication audit trail with WhatsApp notification logs, manual notes/call log storage, latest-first unified communication history, and a dedicated Communication tab.
- 2026-05-02: Implemented balanced behaviour tracking with incidents, positive achievements, restricted counsellor notes, role-filtered student detail analytics, a write API, and a dedicated Behaviour tab.
- 2026-05-02: Implemented audit-ready document storage with multipart uploads, student document metadata, uploader/date tracking, authenticated downloads, and a dedicated Documents tab for certificates, medical files, parent IDs, and agreements.
- 2026-05-02: Implemented role-based access for Teacher, Accountant, Principal/Admin, and Parent users with server-driven student tabs, scoped student queries, finance permissions for accountants, parent-linked student access, cached heavy analytics, and optimized conditional joins.
- 2026-05-02: Created the teacher Homework Management module with class-wide assignment creation, subject selection, description/due dates, submission lifecycle tracking, backend homework APIs, NOT_SUBMITTED support, and integration with the student Homework tab/performance inputs.
- 2026-05-03: Created the teacher Exam & Marks module with class/subject exam creation, bulk marks entry, stored percentage/grade snapshots, class average tracking, backend marks APIs, and integration with Academic analytics/performance inputs.
- 2026-05-03: Upgraded teacher attendance with editable past entries, late marking, class monthly calendar summaries, and backend upsert semantics for one record per student per date feeding attendance analytics/performance.
- 2026-05-03: Created the teacher Communication module with individual/class WhatsApp-style parent messaging, attendance/homework/custom message types, delivery logs, and student profile communication audit integration.
- 2026-05-03: Hardened role-based controls so teachers can access attendance/homework/marks/communication for assigned classes, fees and restricted behaviour notes stay blocked, admin/principal retain full access, and frontend routes mirror backend permissions.
