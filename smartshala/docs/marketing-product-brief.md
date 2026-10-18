# SmartShala Marketing Product Brief

Generated from repository evidence only. Status labels: **[Implemented]** exists in code and has routes/screens/models; **[Partial]** exists but is limited, mocked, role-scoped, or not end-to-end; **[Planned/stub]** appears as a placeholder/config/model without a complete product surface. Anything not found is called out as **Not found in code**.

## 1. One-Paragraph Summary

**[Implemented]** SmartShala is a web-based school CRM/ERP for Indian schools that manages school operations across admissions/enquiries, student records, classes, attendance, fees, exams, homework, communication, payroll, transport, reports, billing, and tenant onboarding. It supports schools from 1 to 10,000 students and 1 to 1,000 staff in the public enquiry form; it stores an optional `affiliationBoard` field, but no specific board such as CBSE/ICSE/state board is hard-coded, so board positioning is **Not found in code**. It appears aimed at single schools or school branches that each receive an isolated tenant database and a school ID. Evidence: `frontend/src/app/onboard/page.tsx`, `backend/src/modules/onboarding/onboarding.schemas.ts`, `backend/prisma/schema.prisma`, `backend/prisma/master/schema.prisma`, `backend/src/services/createSchoolDatabase.ts`.

## 2. User Roles and Permissions

- **[Implemented] Principal**: can access admin workspace plus SmartShala billing. Server routes grant principal access to students, classes, attendance, fees, reports, analytics, settings, users, transport, payroll management, leave approvals, announcements, calendar editing, and billing. Evidence: `backend/prisma/schema.prisma` enum `UserRole`; `frontend/src/components/layout/Sidebar.tsx`; `backend/src/modules/billing/billing.routes.ts`; `backend/src/middleware/auth.ts`.
- **[Implemented] Admin**: school-level admin role with most operational permissions: students, teachers, classes, attendance, fees, reports, analytics, settings, transport, payroll management, leave approvals, announcements, and calendar editing. Billing is deliberately principal-only. Evidence: `frontend/src/components/layout/Sidebar.tsx`; `backend/src/modules/*/*.routes.ts`; `backend/src/modules/billing/billing.routes.ts`.
- **[Implemented] Teacher**: teacher dashboard, assigned classes, homework, marks, communication hub, attendance marking, student profiles, own salary slips, own timetable, leave requests, staff punch-in/break/punch-out. Teacher data is scoped in services, including assigned student/class views and fee field stripping in student profiles. Evidence: `frontend/src/components/layout/Sidebar.tsx`; `frontend/src/components/layout/AuthGuard.tsx`; `backend/src/modules/homework/homework.routes.ts`; `backend/src/modules/marks/marks.routes.ts`; `backend/src/modules/students/students.service.ts`; `backend/src/modules/staffAttendance/staffAttendance.routes.ts`.
- **[Implemented] Accountant**: can access fees and student views; server grants finance routes for fee dashboard, structures read, payments, adjustments, ledgers, defaulters, and receipts. Evidence: `frontend/src/components/layout/Sidebar.tsx`; `frontend/src/components/layout/AuthGuard.tsx`; `backend/src/modules/fees/fees.routes.ts`.
- **[Partial] Parent**: role exists and can access student profiles and report-card PDF routes; frontend navigation only exposes Student. No parent-specific mobile app or parent dashboard beyond student profile access was found. Evidence: `backend/prisma/schema.prisma`; `frontend/src/components/layout/Sidebar.tsx`; `frontend/src/components/layout/AuthGuard.tsx`; `backend/src/modules/students/students.routes.ts`.
- **Not found in code: Student role**. `UserRole` contains `PRINCIPAL`, `ADMIN`, `TEACHER`, `ACCOUNTANT`, `PARENT`; no `STUDENT` role. Evidence: `backend/prisma/schema.prisma`, `frontend/src/types/index.ts`.
- **[Implemented] Super admin**: platform operator signs into `/super-admin`, manages schools, users, password resets, subscriptions, plans, coupons, invoices, renewals, and payment links. Evidence: `backend/src/modules/superAdmin/superAdmin.routes.ts`; `frontend/src/app/super-admin/page.tsx`; `frontend/src/app/super-admin/billing/page.tsx`.
- **[Implemented] Sales CRM admin / sales**: separate CRM roles `ADMIN` and `SALES`; admin manages team, stages, and Meta integration; sales manages assigned leads/deals. Evidence: `backend/prisma/master/schema.prisma`; `backend/src/modules/crm/crm.routes.ts`; `frontend/src/app/crm/layout.tsx`.

## 3. Modules and Features

### Admissions / Enquiries / Sales CRM

- **[Implemented]** Public enquiry form at `/onboard` collects school name, owner/principal, email, phone, address, student count, staff count, and terms acceptance; it creates a CRM lead, not a school. Evidence: `frontend/src/app/onboard/page.tsx`; `backend/src/modules/onboarding/onboarding.routes.ts`.
- **[Implemented]** Sales CRM has lead list, deal detail, stages, notes, proformas, payment links, payments, team, custom stages, and Meta Lead Ads integration. Routes/screens: `/crm`, `/crm/deals/[leadId]`, `/crm/payments`, `/crm/team`, `/crm/stages`, `/crm/integrations`. Evidence: `backend/src/modules/crm/crm.routes.ts`; `frontend/src/app/crm/*`.
- **[Implemented]** Paid lead can be converted/onboarded into a school and issued login details. Evidence: `backend/src/modules/crm/crm.routes.ts`; `backend/src/modules/crm/crm.conversion.ts`.

### Student Information

- **[Implemented]** Student CRUD, import, activation/deactivation, profile pages, profile photo URL, guardian/father/mother details, Aadhaar, APAAR, previous school, transport requirement, documents, behaviour records, attendance, academics, fees, communication, homework, and edit history. Routes/screens: `/students`, `/students/new`, `/students/[id]`, `/students/[id]/edit`. Evidence: `backend/prisma/schema.prisma`; `backend/src/modules/students/students.routes.ts`; `frontend/src/app/(app)/students/*`.
- **[Partial]** Behaviour tracking exists with teacher-created behaviour records and admin action updates; restricted counsellor notes are principal/admin-only. No standalone counselling module found. Evidence: `backend/src/modules/students/students.routes.ts`; `backend/src/modules/students/students.service.ts`.

### Classes, Subjects, Timetable

- **[Implemented]** Class CRUD, class students, stats, class timetable, subjects, class teacher, academic year, stream, medium of instruction, maximum strength. Routes/screens: `/classes`, `/classes/new`, `/classes/[id]`. Evidence: `backend/src/modules/classes/classes.routes.ts`; `backend/prisma/schema.prisma`.
- **[Implemented]** Teacher period assignments and weekly timetable; period times configurable. Routes/screens: `/teachers`, `/teachers/[id]/edit`, `/settings`, teacher `/teacher/classes`. Evidence: `backend/src/modules/users/users.routes.ts`; `backend/src/modules/settings/settings.routes.ts`; `backend/prisma/schema.prisma`.

### Attendance

- **[Implemented]** Student attendance for classes, roster, daily report, monthly student/class reports, dashboard, holidays, pending teacher nudges. Routes/screens: `/attendance`, `/attendance/mark`, `/attendance/reports`, `/reports/daily-attendance`, `/dashboard/attendance`. Evidence: `backend/src/modules/attendance/attendance.routes.ts`; `frontend/src/app/(app)/attendance/*`.
- **[Implemented]** Staff attendance punch-in, break, punch-out, history, day view, and staff month summary. Evidence: `backend/src/modules/staffAttendance/staffAttendance.routes.ts`; `backend/prisma/schema.prisma`.

### Fees / Payments

- **[Implemented]** Fee structures, installments, class assignment, student fee assignments, payments, adjustments, ledgers, defaulters, receipt PDFs, WhatsApp receipt sending, transport fee component, duplicate/archive structures. Routes/screens: `/fees`, `/fees/new`, `/fees/[studentId]`, `/fees/ledger/[studentId]`, `/fees/defaulters`, `/receipt/[receiptId]`, `/[schoolId]/receipt/[receiptId]`. Evidence: `backend/src/modules/fees/fees.routes.ts`; `backend/prisma/schema.prisma`.
- **[Implemented]** School subscription billing via Razorpay/mock gateway, invoices, plans, quotes, auto-renew, payment links, GST/tax fields, PDF invoices. Routes/screens: `/billing`, `/pay/[token]`, `/super-admin/billing`, `/super-admin/renewals`. Evidence: `backend/src/modules/billing/*.routes.ts`; `backend/src/services/razorpay/index.ts`; `backend/prisma/master/schema.prisma`.

### Exams / Report Cards / Marks

- **[Implemented]** Exams with terms, subjects, max/passing marks, marks entry, result updates, grading, report-card PDF. Routes/screens: `/exams`, `/teacher/marks`, `/reports/exams`, `/students/[id]/report-card/pdf`. Evidence: `backend/src/modules/marks/marks.routes.ts`; `backend/src/modules/students/report-card.service.ts`; `backend/prisma/schema.prisma`.

### Homework

- **[Implemented]** Homework assignments by class/subject, due dates, max marks, submission tracking and status updates. Routes/screens: `/teacher/homework`, student profile homework tab. Evidence: `backend/src/modules/homework/homework.routes.ts`; `backend/prisma/schema.prisma`.

### Communication / WhatsApp / Announcements

- **[Implemented]** Teacher/principal communication hub with messages, templates, communication logs, parent message types, message statuses. Routes/screens: `/teacher/communication`, `/notifications`. Evidence: `backend/src/modules/communication/communication.routes.ts`; `backend/prisma/schema.prisma`; `frontend/src/lib/communicationTemplates.ts`.
- **[Partial]** WhatsApp provider class exists as `WhatsAppCloudProvider`; when credentials are absent it returns a dry-run/queued placeholder rather than a real provider call in the inspected file. Evidence: `backend/src/modules/notifications/whatsapp.service.ts`.
- **[Implemented]** Announcements for all/staff/teachers/parents with priority and read receipts. Evidence: `backend/src/modules/announcements/announcements.routes.ts`; `backend/prisma/schema.prisma`.

### Calendar / Leave / HR / Payroll

- **[Implemented]** Calendar monthly view with events and holidays; admin/principal edit events, teachers read. Evidence: `backend/src/modules/calendar/calendar.routes.ts`; `backend/prisma/schema.prisma`.
- **[Implemented]** Leave requests with attachments, own leave list, school leave approvals, download attachment, cancel. Evidence: `backend/src/modules/leave/leave.routes.ts`.
- **[Partial]** Payroll supports shifts, pay profiles, attendance-based calculation, salary slips, generation, and staff own slips. The schema comment says manual salary slips exist and payroll measures attendance against shifts; no statutory payroll, PF/ESI/TDS, or bank payout integration found. Evidence: `backend/src/modules/payroll/payroll.routes.ts`; `backend/prisma/schema.prisma`.

### Transport

- **[Implemented]** Vehicles, routes, ordered stops, student assignments, overview, transport report, transport fee amount on students. Routes/screens: `/transport`, `/reports/transport`. Evidence: `backend/src/modules/transport/transport.routes.ts`; `backend/prisma/schema.prisma`.
- **Not found in code:** live GPS tracking.

### Library

- **Not found in code.** No library module/routes/models found in `backend/src/modules`, `frontend/src/app`, or Prisma schemas.

### Inventory

- **Not found in code.** No inventory module/routes/models found in `backend/src/modules`, `frontend/src/app`, or Prisma schemas.

### Reports / Dashboards / Analytics

- **[Implemented]** Role-aware dashboards, fee overview, attendance chart, activity feed, alert panel, daily principal report, pending fees, risk, class reports, exam reports, monthly student reports, risk summary, class performance. Routes/screens: `/dashboard`, `/analytics`, `/reports`, `/reports/daily-attendance`, `/reports/student-performance`, `/reports/subject-wise`, `/reports/teacher-performance`, `/reports/exams`, `/reports/transport`. Evidence: `backend/src/modules/dashboard/dashboard.routes.ts`; `backend/src/modules/reports/reports.routes.ts`; `backend/src/modules/analytics/analytics.routes.ts`; `frontend/src/features/dashboard/DashboardHome.tsx`.

### Settings / Admin Ops

- **[Implemented]** School profile, period times, academic years, rollover preview/commit, database deletion request/cancel, activity logs, password reset requests. Evidence: `backend/src/modules/settings/settings.routes.ts`; `backend/src/modules/academicYears/academicYears.routes.ts`; `backend/src/modules/activity/activity.routes.ts`; `frontend/src/app/(app)/activity-logs/page.tsx`.

### AI Chatbot

- **[Partial]** Chatbot routes and provider abstraction exist for Anthropic, Gemini, and OpenRouter with token limits. Need product owner confirmation before marketing as a school-facing AI feature because the visible screen is a chat widget and exact capabilities depend on configuration. Evidence: `backend/src/modules/chatbot/chatbot.routes.ts`; `backend/src/modules/chatbot/chatbot.providers.ts`; `frontend/src/components/chat/ChatWidget.tsx`.

## 4. Key Workflows End to End

- **[Implemented] Enquiry to onboarded school**: visitor opens `/onboard`, submits school details, backend creates CRM lead, sales issues proforma, creates payment link, lead pays through `/pay/[token]`, CRM retries/runs onboarding, Neon tenant DB is created/migrated, principal account is seeded, login details can be issued. Evidence: `frontend/src/app/onboard/page.tsx`; `backend/src/modules/onboarding/onboarding.routes.ts`; `backend/src/modules/crm/crm.routes.ts`; `backend/src/services/createSchoolDatabase.ts`.
- **[Implemented] Student admission/setup to fee collection**: admin/principal creates class, creates/imports student, creates fee structure, assigns fee to class/student, accountant/principal/admin records payment, receipt PDF is generated, receipt can be sent via WhatsApp. Evidence: `backend/src/modules/classes/classes.routes.ts`; `backend/src/modules/students/students.routes.ts`; `backend/src/modules/fees/fees.routes.ts`.
- **[Partial] Marking attendance to parent notification**: teacher/admin marks attendance; attendance records are stored; notifications/WhatsApp routes and templates exist for absence/low attendance; admin can nudge pending teachers. Direct automatic “on mark attendance send parent WhatsApp” is not clearly proven from the route file alone. Evidence: `backend/src/modules/attendance/attendance.routes.ts`; `backend/src/modules/notifications/notifications.routes.ts`; `backend/prisma/schema.prisma`.
- **[Implemented] Teacher academic workflow**: admin assigns teacher periods/subjects; teacher sees own schedule/classes; teacher creates homework or marks exams/results for assigned subjects; student profile/report screens show academic data. Evidence: `backend/src/modules/users/users.routes.ts`; `backend/src/modules/homework/homework.routes.ts`; `backend/src/modules/marks/marks.routes.ts`.
- **[Implemented] Staff attendance to payroll**: staff punch in/break/punch out; principal/admin defines shifts/pay profiles; payroll calculation reads attendance; salary slips can be generated and viewed by staff. Evidence: `backend/src/modules/staffAttendance/staffAttendance.routes.ts`; `backend/src/modules/payroll/payroll.routes.ts`.
- **[Implemented] Transport setup**: principal/admin creates vehicle, creates route/stops, assigns students, views transport report. Evidence: `backend/src/modules/transport/transport.routes.ts`.

## 5. Differentiators

- **[Implemented] Isolated tenant database per school** with generated school ID and tenant Prisma clients. Evidence: `backend/src/services/createSchoolDatabase.ts`; `backend/src/tenant/prismaManager.ts`; `backend/src/tenant/tenantResolver.ts`.
- **[Implemented] Sales CRM tied to onboarding**: website enquiry becomes a lead, payment triggers school creation, and CRM can issue login details. Evidence: `backend/src/modules/onboarding/onboarding.routes.ts`; `backend/src/modules/crm/crm.routes.ts`.
- **[Implemented] Meta Lead Ads import** with Page/form selection, encrypted stored token, import dedupe, and round-robin sales assignment. Evidence: `backend/src/modules/crm/crm.meta.ts`; `backend/prisma/master/schema.prisma`.
- **[Implemented] Payment links for subscriptions and leads**: token-authenticated payment pages, proforma/invoice links, revoke/share tracking. Evidence: `backend/src/modules/billing/paymentLinks.routes.ts`; `backend/src/modules/crm/crm.routes.ts`; `frontend/src/app/pay/[token]/page.tsx`.
- **[Partial] AI assistant** provider abstraction supports Anthropic, Gemini, OpenRouter. Evidence: `backend/src/modules/chatbot/chatbot.providers.ts`; `frontend/src/components/chat/ChatWidget.tsx`.
- **[Implemented] Mobile principal and teacher apps** in Flutter with separate launchers/assets. Evidence: `mobile/lib/main_principal.dart`; `mobile/lib/main_teacher.dart`; `mobile/pubspec.yaml`.
- **[Implemented] Hindi/English UI toggle** exists, but inspected Hindi strings appear encoding-corrupted in terminal output, so market as partial until verified in browser. Evidence: `frontend/src/components/layout/PlatformLanguage.tsx`.

## 6. Integrations

- **[Implemented] Razorpay** live/mock gateway for subscription checkout, payment links, signatures, webhooks, and refunds. Evidence: `backend/src/services/razorpay/index.ts`; `backend/src/routes/webhooks.ts`.
- **[Partial] WhatsApp Cloud Provider** named in code; dry-run behavior when WhatsApp credentials are absent. Evidence: `backend/src/modules/notifications/whatsapp.service.ts`; `backend/src/config/env.ts`.
- **[Implemented] Meta / Facebook Graph API v24.0** for lead ads. Evidence: `backend/src/modules/crm/crm.meta.ts`.
- **[Partial] AWS S3 / S3-compatible storage** for student documents and leave attachments; local fallback exists. Default S3 region is `ap-south-1` if configured. Evidence: `backend/src/services/storageService.ts`; `backend/src/config/env.ts`.
- **[Partial] Neon** tenant database creation via Neon API environment variables. Evidence: `backend/src/services/createSchoolDatabase.ts`; `backend/src/config/env.ts`.
- **[Partial] AI providers**: Anthropic, Google Generative AI/Gemini, OpenRouter. Evidence: `backend/src/modules/chatbot/chatbot.providers.ts`.
- **Not found in code:** SMS provider, email sender provider, Google Workspace/Classroom integration, biometric devices, accounting software integration.

## 7. Platforms

- **[Implemented] Web app**: Next.js 15, React 19, responsive app shell and role navigation. Evidence: `frontend/package.json`; `frontend/src/components/layout/AuthGuard.tsx`; `frontend/src/components/layout/Sidebar.tsx`.
- **[Implemented] Mobile apps**: Flutter app labelled “SmartShala V2 mobile apps — Principal Portal and Teacher Portal.” Evidence: `mobile/pubspec.yaml`; `mobile/lib/main_principal.dart`; `mobile/lib/main_teacher.dart`.
- **[Partial] Responsive web**: sidebar has mobile overlay and responsive Tailwind classes; not a formal PWA. Evidence: `frontend/src/components/layout/Sidebar.tsx`.
- **Not found in code: PWA manifest/service worker/offline support.**
- **[Partial] Languages/i18n**: English default plus Hindi toggle/dictionary. Evidence: `frontend/src/components/layout/PlatformLanguage.tsx`; `frontend/src/app/layout.tsx`.
- **Not found in code: Parent mobile app.**

## 8. Architecture Facts Schools Care About

- **[Implemented] Multi-tenant**: route prefix `/:schoolId/api`, master DB lookup, tenant database URL per school, tenant Prisma client cache. Evidence: `backend/src/app.ts`; `backend/src/tenant/tenantResolver.ts`; `backend/src/tenant/prismaManager.ts`; `backend/prisma/master/schema.prisma`.
- **[Partial] Multi-branch support**: tenant isolation can support multiple school records, but there is no explicit branch hierarchy model. **Not found in code** as a branch feature. Evidence: `backend/prisma/master/schema.prisma`; `backend/prisma/schema.prisma`.
- **[Partial] Hosting/region**: Neon is used for tenant DB creation if configured; S3 default region is `ap-south-1`; actual deployed hosting/region values are **Not found in code** without env values. Evidence: `backend/src/services/createSchoolDatabase.ts`; `backend/src/config/env.ts`.
- **[Implemented] Auth**: JWT bearer access tokens, refresh tokens, httpOnly cookie session restoration, tenant-bound tokens, CRM and super-admin auth separated. Evidence: `backend/src/middleware/auth.ts`; `backend/src/modules/auth/auth.routes.ts`; `backend/src/modules/crm/crm.auth.ts`; `backend/src/modules/superAdmin/superAdmin.middleware.ts`.
- **[Implemented] Role-based access**: server `requireRole` plus client role redirects. Evidence: `backend/src/middleware/auth.ts`; `frontend/src/components/layout/AuthGuard.tsx`.
- **[Implemented] Audit logs/activity logs**: tenant `AuditLog` model and mutating request audit middleware; activity log route/screen. Evidence: `backend/prisma/schema.prisma`; `backend/src/middleware/activityAudit.ts`; `backend/src/modules/activity/activity.routes.ts`; `frontend/src/app/(app)/activity-logs/page.tsx`.
- **[Partial] Backups**: master DB backup script/runbook exists; tenant backup automation is not clearly visible from code. Evidence: `backend/scripts/backup-master-db.mjs`; `backend/docs/master-db-backup-runbook.md`.
- **[Partial] Data export**: CSV/export copy appears in reports/mobile; no universal export center found. Evidence: `frontend/src/components/layout/PlatformLanguage.tsx`; `mobile/lib/features/principal/students/student_export.dart`.

## 9. Plans, Pricing, Limits, Feature Flags

- **[Implemented] Plans**: master DB `Plan` model has code, name, price in minor units, currency, billing interval, trial days, max students, max staff, JSON features, active/public flags. Evidence: `backend/prisma/master/schema.prisma`.
- **[Implemented] Coupons and custom school pricing**: coupon model/service and subscription `customPriceMinor`; quote applies discount and GST after discount. Evidence: `backend/prisma/master/schema.prisma`; `backend/src/modules/billing/billing.pricing.ts`; `backend/src/modules/billing/billingAdmin.routes.ts`.
- **[Implemented] Billing limits/config**: GST tax percent, grace days, invoice due days, renewal lead days, payment link expiry days, chat token limits. Evidence: `backend/src/config/env.ts`.
- **[Partial] Feature flags**: environment flags include `BACKGROUND_WORKERS_ENABLED`, `DEMO_RESET_ENABLED`, `CONNECT_DATABASE_ON_BOOT`, `DB_WARMUP_ENABLED`; no user-facing feature flag dashboard found. Evidence: `backend/src/config/env.ts`.
- **[Implemented] Onboarding form limits**: 1-10,000 students and 1-1,000 staff. Evidence: `backend/src/modules/onboarding/onboarding.schemas.ts`.

## 10. Onboarding

- **[Implemented] Signup/enquiry URL**: `/onboard`; success URL `/onboarding-success?lead=...`. Evidence: `frontend/src/app/onboard/page.tsx`; `frontend/src/app/onboarding-success/page.tsx`.
- **[Implemented] Login URLs**: `/login` and tenant login `/[schoolId]/login`. Evidence: `frontend/src/app/(auth)/login/page.tsx`; `frontend/src/app/[schoolId]/login/page.tsx`.
- **[Implemented] Payment URL**: `/pay/[token]`. Evidence: `frontend/src/app/pay/[token]/page.tsx`; `backend/src/modules/billing/paymentLinks.routes.ts`.
- **[Implemented] Super admin URL**: `/super-admin`; CRM URL `/crm`. Evidence: `frontend/src/app/super-admin/page.tsx`; `frontend/src/app/crm/page.tsx`.
- **[Partial] Demo URL**: backend has `/demo` API module and `DEMO_RESET_ENABLED`; no public `/demo` marketing page found. Evidence: `backend/src/modules/demo/demo.routes.ts`; `backend/src/config/env.ts`.

## 11. Brand

- **[Implemented] Logo source files copied to marketing assets**:
  - `frontend/public/logo.png` -> `docs/marketing-assets/frontend-logo.png`
  - `frontend/public/logo-latest.png` -> `docs/marketing-assets/frontend-logo-latest.png`
  - `frontend/public/ss.png` -> `docs/marketing-assets/frontend-ss.png`
  - `mobile/assets/brand/logo.png` -> `docs/marketing-assets/mobile-brand-logo.png`
- **[Implemented] Web colours**: `--brand-primary #2456E6`, hover `#1B45BD`, active `#1638A0`, secondary `#0F2557`, accent `#7C3AED`, success `#0F8A4A`, warning `#B95A00`, danger `#C8242C`, info `#1F6FB8`, ink `#0F1419`, surface `#F7F8FB`; Apple palette includes `#0071e3`, `#34c759`, `#ff9500`, `#ff3b30`. Evidence: `frontend/src/app/globals.css`; `frontend/tailwind.config.ts`.
- **[Implemented] Fonts**: Inter primary, Hind/Mukta/Noto Sans Devanagari for Devanagari, SFMono/Cascadia/Roboto Mono/Consolas for code; Flutter bundles Inter. Evidence: `frontend/src/app/globals.css`; `mobile/pubspec.yaml`.
- **[Partial] Icon library**: no lucide/react-icons dependency found; app uses inline SVG icons and `cupertino_icons` in Flutter. Evidence: `frontend/package.json`; `frontend/src/components/layout/Sidebar.tsx`; `mobile/pubspec.yaml`.
- **[Implemented] Tone of UI copy**: operational, school-admin focused, direct labels such as “Collection Command Center,” “Attendance and Fee Risk Insights,” “Send Fee Reminder,” “Nudge Teachers,” “Get SmartShala for your school.” Evidence: `frontend/src/components/layout/PlatformLanguage.tsx`; `frontend/src/app/onboard/page.tsx`.
- **[Implemented] Indian-specific terms**: class, section, academic year/session, roll number, admission number, fee heads/fee structures/installments, Aadhaar, APAAR, GSTIN, SAC code, CGST/SGST/IGST logic, UPI, cheque, DD, parent/guardian, class teacher. Evidence: `backend/prisma/schema.prisma`; `backend/prisma/master/schema.prisma`; `backend/src/config/env.ts`; `frontend/src/components/layout/PlatformLanguage.tsx`.

## 12. Screenshot List

Use demo/synthetic data only; do not use real students or parents.

1. **[Implemented] Admin dashboard** `/dashboard`: fill with 600 students, 24 classes, 95% attendance, fee collection, alerts, and recent activity. Evidence: `frontend/src/app/(app)/dashboard/page.tsx`; `frontend/src/features/dashboard/DashboardHome.tsx`.
2. **[Implemented] Student profile** `/students/[id]`: use a synthetic student with attendance, fees, academics, documents, communication, behaviour, and homework tabs populated. Evidence: `frontend/src/app/(app)/students/[id]/_components/StudentProfilePage.tsx`.
3. **[Implemented] Fees command center** `/fees`: show fee KPIs, active structures, recent payments, and pending balances. Evidence: `frontend/src/app/(app)/fees/page.tsx`.
4. **[Implemented] Attendance marking** `/attendance` or `/attendance/mark`: show one class roster with present/absent/late/half-day statuses. Evidence: `frontend/src/app/(app)/attendance/page.tsx`; `backend/src/modules/attendance/attendance.routes.ts`.
5. **[Implemented] Exams & marks** `/exams`: show class exam with subjects, marks, pass/fail/grade data. Evidence: `frontend/src/app/(app)/exams/page.tsx`; `backend/src/modules/marks/marks.routes.ts`.
6. **[Implemented] Reports hub** `/reports`: show daily attendance, student performance, subject-wise, teacher performance, exam, and transport tiles. Evidence: `frontend/src/app/(app)/reports/page.tsx`.
7. **[Implemented] Transport** `/transport`: show vehicles, routes, stops, student assignments. Evidence: `frontend/src/app/(app)/transport/page.tsx`; `backend/src/modules/transport/transport.routes.ts`.
8. **[Implemented] Payroll** `/payroll`: show staff attendance-derived calculation and salary slips for synthetic staff. Evidence: `frontend/src/app/(app)/payroll/page.tsx`; `backend/src/modules/payroll/payroll.routes.ts`.
9. **[Implemented] Sales CRM board/list** `/crm`: show lead stages, proforma sent, paid, missed sales, assigned sales users. Evidence: `frontend/src/app/crm/page.tsx`; `backend/src/modules/crm/crm.routes.ts`.
10. **[Implemented] Public onboarding** `/onboard`: show the enquiry form and left-side value column, with no real contact info. Evidence: `frontend/src/app/onboard/page.tsx`.

## 13. Open Questions

- Which board(s) should marketing name? The code stores `affiliationBoard`, but no specific board claim is coded.
- Is SmartShala sold as single-school, multi-branch, or school-chain software? Branch hierarchy is not found.
- Should WhatsApp be marketed as live today? Provider code has a dry-run fallback and placeholder provider message IDs when credentials are absent.
- Should the AI assistant be promoted publicly? Providers and chat widget exist, but exact supported school workflows need owner confirmation.
- Is Hindi support production-ready? The dictionary exists, but terminal output suggests encoding problems.
- Are library and inventory planned? They are requested in the marketing outline but not found in code.
- What are current live plan prices? Plans are database-driven, so fixed price amounts are not in code.
- What is the production hosting region? Code references Neon and S3 region defaults, but no real deployment values are included.

## Git Log Summary: Last 30 Commits

- `11d23eb` 2026-10-09: call lost deals missed sales in the CRM.
- `aa31a9e` 2026-10-09: import leads from Meta lead ads into the CRM.
- `8480899` 2026-10-08: call leads deals in the CRM, add a board view, and let sales copy the payment link.
- `5352bd8` 2026-10-08: let teachers punch in again and take breaks, and pay them from shifts.
- `cda4f9c` 2026-10-08: add a sales CRM that turns a paying lead into a school.
- `9a21910` 2026-09-25: show the principal who is in today on the web dashboard too.
- `23c8896` 2026-09-24: paint pickers and dropdown menus in the app's colours, not Material's purple.
- `cb49f7d` 2026-09-23: let staff change their password in both apps.
- `24d68b6` 2026-09-23: show the principal which teachers are in today, on leave, or not in.
- `c6e778e` 2026-09-23: open the teacher's More tile onto the screens the grid has no tile for.
- `a944a20` 2026-09-23: give both apps an icon of their own, and a slot for the signing key.
- `707b318` 2026-09-23: let a teacher set homework for the subject their timetable says they teach.
- `bc8573e` 2026-09-22: let a teacher examine the subject their timetable says they teach.
- `99f7175` 2026-09-22: show the week's timetable in both apps, and build long lists on demand.
- `caddabc` 2026-09-17: record school transport: vehicles, routes with stops, and who rides them.
- `1f9eca7` 2026-09-17: let pushed app screens find their data, and stop refresh from throwing.
- `6956243` 2026-09-14: fees, calendar, exams, reports and classes in the principal app.
- `ff1f14f` 2026-09-14: let the principal manage students and teachers from the app.
- `a0ca9c3` 2026-09-13: give the principal app a home that says what the web dashboard says.
- `7615eac` 2026-09-13: pay slips for staff, and one teacher dashboard on web and in the app.
- `97184b6` 2026-09-10: let teachers punch in, ask for leave and see their own day from the app.
- `f559c66` 2026-09-10: give the super admin a renewals desk and a portal that stays out of the way.
- `2f31ff7` 2026-09-10: unbreak the backend build by dropping routers that were never committed.
- `f574fcb` 2026-09-09: merge subscription billing PR #3.
- `6d0462a` 2026-09-09: send schools a link to pay, and an invoice their accountant will accept.
- `428eb74` 2026-09-08: merge subscription billing PR #2.
- `bd26a51` 2026-09-08: let the Razorpay checkout past the content security policy.
- `bbdfe1d` 2026-09-07: merge subscription billing PR #1.
- `afa71f6` 2026-09-07: open the real Razorpay checkout when the gateway is live.
- `1d47af5` 2026-09-07: give schools an invoice they can file and a message when money moves.

