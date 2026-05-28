# Project Requirements Document (PRD)

**Product Name**: SmartShala
**Product Type**: School Operations ERP (SaaS, Multi-Tenant)
**Target Market**: K-12 Indian Private Schools (CBSE, ICSE, State Boards)
**Core Value Proposition**: WhatsApp-first school ERP for daily operations — attendance, fees, homework, marks, parent communication, and risk analytics.

#### Business Goals
1. Digitize day-to-day school operations for Indian schools (attendance, fees, student records).
2. Automate parent communication via WhatsApp (attendance alerts, fee reminders, receipts).
3. Provide principal-level analytics and risk dashboards.
4. Offer multi-tenant SaaS with per-school database isolation on Neon PostgreSQL.

#### Functional Requirements (V1 — Implemented)
| # | Requirement | Status |
|---|------------|--------|
| 1 | User authentication (JWT, role-based) | ✅ Done |
| 2 | Student CRUD with detailed profile view (7 tabs) | ✅ Done |
| 3 | Teacher management with period timetables | ✅ Done |
| 4 | Class management with class teacher assignment | ✅ Done |
| 5 | Attendance marking (P/A/L/Half-Day) per class per date | ✅ Done |
| 6 | Fee structures, installments, partial payments, receipts | ✅ Done |
| 7 | Exam & marks entry with term grouping | ✅ Done |
| 8 | Homework assignments and submission tracking | ✅ Done |
| 9 | WhatsApp notification logging & templated messaging | ✅ Done |
| 10 | PDF receipt generation (pdfkit) | ✅ Done |
| 11 | Principal & teacher role dashboards | ✅ Done |
| 12 | Risk analytics (attendance + fee signals) | ✅ Done |
| 13 | Communication audit trail (WhatsApp, calls, manual notes) | ✅ Done |
| 14 | Behaviour tracking (incidents, achievements, counsellor notes) | ✅ Done |
| 15 | Student document storage (Aadhaar, certificates, etc.) | ✅ Done |
| 16 | Audit log infrastructure with edit history | ✅ Done |
| 17 | Multi-tenant onboarding with database-per-tenant | ✅ Done |
| 18 | Super admin panel for school management | ✅ Done |
| 19 | Trial system (30-day free trial with auto-expiry) | ✅ Done |
| 20 | Tenant database deletion with 3-day cancellation window | ✅ Done |
| 21 | Fee adjustments (concessions, discounts) | ✅ Done |
| 22 | Daily/monthly attendance reports with export | ✅ Done |

#### Out of Scope (V1)
- Parent login / parent mobile app
- Online payment gateway (Razorpay/Cashfree) — payment is simulated
- Hostel, transport, timetable modules
- Custom ML models (rule-based AI only)
- SMS fallback for non-WhatsApp parents
- Offline attendance with sync-on-reconnect
- Accounting integrations (Tally/Zoho)
