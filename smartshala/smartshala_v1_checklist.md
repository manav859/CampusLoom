# SmartShala V1 Completion Checklist

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
- [ ] Generate PDF receipt
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
- [ ] Combine attendance + fees insights

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
