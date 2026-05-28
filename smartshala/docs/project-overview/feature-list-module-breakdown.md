# Feature List / Module Breakdown

| # | Module | Backend Module Dir | Frontend Pages | Description |
|---|--------|-------------------|----------------|-------------|
| 1 | **Authentication** | `auth/` | `(auth)/login`, `[schoolId]/login` | JWT login, forgot-password, session hydration |
| 2 | **Dashboard** | `dashboard/` | `(app)/dashboard` | Principal & teacher dashboards with KPIs, charts, actions |
| 3 | **Students** | `students/` | `(app)/students/*` | CRUD, profile with 7 tabs (Academic, Homework, Attendance, Fees, Communication, Behaviour, Documents) |
| 4 | **Teachers** | `users/` | `(app)/teachers/*` | Teacher CRUD, timetable management |
| 5 | **Classes** | `classes/` | `(app)/classes` | Class CRUD, roster, class teacher assignment, subjects |
| 6 | **Attendance** | `attendance/` | `(app)/attendance` | Mark attendance (P/A/L/Half-Day), daily reports, monthly calendar |
| 7 | **Fees** | `fees/` | `(app)/fees/*` | Fee structures, installments, payments, receipts, defaulters, ledger, adjustments |
| 8 | **Homework** | `homework/` | `(app)/teacher/homework` | Assignment creation, submission tracking, marks, notes |
| 9 | **Marks/Exams** | `marks/` | `(app)/teacher/marks` | Exam creation, bulk marks entry, term grouping, grade calculation |
| 10 | **Communication** | `communication/` | `(app)/teacher/communication` | Parent messaging (WhatsApp, call logs, manual notes) |
| 11 | **Notifications** | `notifications/` | `(app)/notifications` | WhatsApp logs, delivery status, retry |
| 12 | **WhatsApp** | `whatsapp/` | — | WhatsApp Cloud API integration, send/bulk endpoints |
| 13 | **Analytics** | `analytics/` | `(app)/analytics` | Risk insights, at-risk students, combined signals |
| 14 | **Reports** | `reports/` | `(app)/reports` | Daily/monthly reports, fee reports, export (CSV/PDF) |
| 15 | **Settings** | `settings/` | `(app)/settings` | School profile, GSTIN, U-DISE, period count, logo |
| 16 | **Activity Logs** | `activity/` | `(app)/activity-logs` | Audit trail, edit history |
| 17 | **Onboarding** | `onboarding/` | `onboard/` | New school registration, trial activation |
| 18 | **Super Admin** | `superAdmin/` | `super-admin/` | Platform-level school management, password resets |
| 19 | **Tenant Setup** | `tenantSetup/` | — | Tenant database deletion, status checking |
| 20 | **Demo** | `demo/` | — | Demo data reset endpoints |
