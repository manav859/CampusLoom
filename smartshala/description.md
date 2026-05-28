# SmartShala — Complete Project Description & Handover Document

> **Project**: SmartShala (CampusLoom)
> **Version**: 1.0.0
> **Generated**: 28 May 2026
> **Repository**: `manav859/CampusLoom` → `d:\siteonlab\CampusLoom\smartshala`

---

## 📁 PROJECT OVERVIEW

### ☑ Project Requirements Document (PRD)

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

---

### ☑ System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                Next.js 15 / React 19 / Tailwind CSS             │
│                  Frontend: http://localhost:3000                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
                           │ Bearer JWT Auth
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS BACKEND                           │
│                  Backend: http://localhost:4000                  │
│                                                                 │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Helmet  │ │   CORS   │ │  Morgan  │ │  Pino HTTP Logger │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TENANT MIDDLEWARE (/:schoolId/api)           │   │
│  │  tenantResolver → prismaManager → AsyncLocalStorage      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE LAYER                             │   │
│  │  requireAuth → requireRole → validate (Zod) → rateLimit │   │
│  │  auditMutatingRequest → dbWarmup → errorHandler          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                20 API MODULE ROUTERS                      │   │
│  │  auth, students, classes, attendance, fees, homework,     │   │
│  │  marks, dashboard, analytics, reports, settings,          │   │
│  │  notifications, communication, whatsapp, users, demo,     │   │
│  │  activity-logs, onboarding, super-admin, tenant-setup     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            BACKGROUND WORKERS (setInterval)               │   │
│  │  trialExpiryWorker (1hr) │ databaseDeletionWorker (1hr)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Prisma ORM
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEON POSTGRESQL (Cloud)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  master_db   │  │ school_AB12CD34  │  │ school_XYZ91KLM │   │
│  │  (Platform)  │  │   (Tenant 1)     │  │   (Tenant 2)    │   │
│  └──────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                 │
│  master_db: Schools, Coupons, OnboardingLogs, PasswordResets    │
│  school_*:  Users, Students, Classes, Attendance, Fees, etc.    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│             EXTERNAL SERVICES (Placeholder/Mock)                │
│                                                                 │
│  WhatsApp Cloud API (templated messages)                        │
│  Redis (queued, not required — placeholder)                     │
│  Neon API (database provisioning via REST)                      │
└─────────────────────────────────────────────────────────────────┘
```

**Architecture Pattern**: Database-per-tenant multi-tenancy with path-based routing (`/:schoolId/api/...`). Each tenant school gets an isolated PostgreSQL database on Neon. Tenant context is injected via Node.js `AsyncLocalStorage` per request.

---

### ☑ Tech Stack Document

#### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | ^15.0.3 | React framework (App Router) |
| React | ^19.0.0 | UI library |
| React DOM | ^19.0.0 | DOM rendering |
| Tailwind CSS | ^3.4.15 | Utility-first CSS |
| Framer Motion | ^12.38.0 | Animations & transitions |
| Recharts | ^3.8.1 | Charts & data visualization |
| TypeScript | ^5.6.3 | Type safety |
| PostCSS | ^8.4.49 | CSS processing |
| Autoprefixer | ^10.4.20 | CSS vendor prefixes |
| ESLint | ^9.15.0 | Linting |

#### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ (required) | Runtime |
| Express.js | ^4.21.1 | HTTP framework |
| Prisma | ^5.22.0 | ORM & migrations |
| TypeScript | ^5.6.3 | Type safety |
| Zod | ^3.23.8 | Request validation |
| bcryptjs | ^2.4.3 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT auth tokens |
| Helmet | ^8.0.0 | Security headers |
| CORS | ^2.8.5 | Cross-origin support |
| Morgan | ^1.10.1 | HTTP request logging |
| Pino / Pino HTTP | ^9.4.0 / ^10.3.0 | Structured logging |
| Multer | ^2.1.1 | File uploads |
| PDFKit | ^0.18.0 | PDF receipt generation |
| tsx | ^4.19.2 | TypeScript execution (dev) |

#### Database & Infrastructure

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 14+ | Primary database |
| Neon PostgreSQL (Cloud) | Managed serverless PostgreSQL |
| Neon API | Dynamic tenant database creation/deletion |
| Redis (placeholder) | Queue-ready for notification jobs |

#### Design System

| Token | Value |
|-------|-------|
| Primary font | Inter (sans-serif) |
| Hindi/Devanagari font | Hind / Mukta / Tiro Devanagari Hindi |
| Code font | Monospace (receipt IDs, admission numbers) |
| UI style | Apple-inspired glassmorphism with frosted panels |
| Color palette | Apple palette (blue #0071e3, green #34c759, orange #ff9500, red #ff3b30) |

---

### ☑ Feature List / Module Breakdown

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

---

### ☑ User Roles & Permissions Matrix

| Permission / Feature | PRINCIPAL | ADMIN | TEACHER | ACCOUNTANT | PARENT (V1) |
|---------------------|-----------|-------|---------|------------|-------------|
| View all students | ✅ | ✅ | ❌ (assigned classes only) | ❌ | ❌ (no login) |
| Create/edit students | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark attendance | ✅ | ✅ | ✅ (own classes, class teacher only) | ❌ | ❌ |
| View attendance reports | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Create fee structures | ✅ | ✅ | ❌ | ❌ | ❌ |
| Record payments | ✅ | ✅ | ❌ | ✅ | ❌ |
| View fee ledgers | ✅ | ✅ | ❌ | ✅ | ❌ |
| Fee adjustments (concession/discount) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create homework assignments | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Enter marks | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| View behaviour (counsellor notes) | ✅ | ✅ | ❌ (restricted) | ❌ | ❌ |
| Upload student documents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send WhatsApp messages | ✅ | ✅ | ✅ | ❌ | ❌ |
| Dashboard access | ✅ (school-wide) | ✅ (school-wide) | ✅ (own classes) | ✅ (fees only) | ❌ |
| School settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage teachers/users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tenant deletion | ✅ (with password) | ❌ | ❌ | ❌ | ❌ |

**Super Admin** (platform-level, separate credentials in `.env`):
- View all onboarded schools
- Manage school activation/deactivation
- Process password reset requests
- View onboarding logs

> **Note**: `PARENT` role exists in schema but has no login UI in V1. Parents receive updates via WhatsApp only.

---

## 🗄️ DATABASE & DATA

### ☑ Database Schema / ERD

**Database**: PostgreSQL 14+ on Neon (serverless)
**ORM**: Prisma ^5.22.0
**Schema file**: `backend/prisma/schema.prisma` (766 lines)
**Master schema**: `backend/prisma/master/schema.prisma` (120 lines)

#### Tenant Database Models (23 models)

| Model | Table Name | Purpose | Key Relations |
|-------|-----------|---------|---------------|
| `School` | `schools` | Root tenant entity | All other models reference this |
| `User` | `users` | Staff accounts (Principal, Admin, Teacher, Accountant) | → School, classes, subjects |
| `RefreshToken` | `refresh_tokens` | JWT refresh token persistence | → User |
| `Class` | `classes` | Class-section-year combination | → School, Teacher (classTeacher), Students |
| `Student` | `students` | Student records | → School, Class |
| `AuditLog` | `audit_logs` | Immutable audit trail | → School, User (actor) |
| `CommunicationLog` | `communication_logs` | WhatsApp/call/note audit | → School, Student |
| `BehaviourRecord` | `behaviour_records` | Incidents, achievements, counsellor notes | → School, Student, User |
| `StudentDocument` | `student_documents` | Uploaded documents (Aadhaar, certificates, etc.) | → School, Student, User |
| `Subject` | `subjects` | Class subjects with teacher assignment | → School, Class, User (teacher) |
| `TeacherPeriodAssignment` | `teacher_period_assignments` | Timetable (day + period → class + subject) | → School, User, Class, Subject |
| `Exam` | `exams` | Exam definitions (Unit Test, Mid-Term, Final) | → School, Class, Subject |
| `ExamResult` | `exam_results` | Per-student marks with grade and percentage | → School, Student, Exam, Subject |
| `HomeworkRecord` | `homework_records` | Legacy homework tracking | → School, Student, Subject |
| `HomeworkAssignment` | `homework_assignments` | Class-wide homework assignments | → School, Class, Subject, User |
| `HomeworkSubmission` | `homework_submissions` | Per-student submission tracking | → School, Assignment, Student |
| `AttendanceSession` | `attendance_sessions` | One class on one date | → School, Class, User (markedBy) |
| `AttendanceRecord` | `attendance_records` | Per-student attendance | → Session, Student |
| `FeeStructure` | `fee_structures` | Annual/quarterly/monthly/custom fee plans | → School, Class |
| `FeeInstallment` | `fee_installments` | Installment breakdown with due dates | → FeeStructure |
| `StudentFeeAssignment` | `student_fee_assignments` | Student fee ledger (total, paid, pending) | → School, Student, FeeStructure |
| `Payment` | `payments` | Payment records with mode-specific references | → School, Student, Assignment, Installment, User |
| `FeeAdjustment` | `fee_adjustments` | Concessions and discounts | → School, Student, Assignment, User |
| `Receipt` | `receipts` | Auto-numbered receipts linked to payments | → School, Payment |
| `Notification` | `notifications` | WhatsApp notification queue/log | → School, Student, User |

#### Master Database Models (4 models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `School` | `schools` | Tenant registry (schoolId, dbUrl, plan, trial, deletion status) |
| `PasswordResetRequest` | `password_reset_requests` | Staff password reset requests for super admin |
| `Coupon` | `coupons` | Discount coupons for onboarding |
| `OnboardingLog` | `onboarding_logs` | Onboarding event audit |

#### Enums (19 enums)

`UserRole` (PRINCIPAL, ADMIN, TEACHER, ACCOUNTANT, PARENT), `UserStatus`, `Gender`, `AttendanceStatus` (PRESENT, ABSENT, LATE, HALF_DAY), `FeeFrequency`, `InstallmentStatus`, `PaymentMode` (CASH, UPI, BANK_TRANSFER, CHEQUE, DD, ONLINE_GATEWAY, OTHER), `FeeComponent`, `FeeAdjustmentType`, `ExamTerm`, `NotificationKind`, `NotificationStatus`, `HomeworkSubmissionStatus`, `CommunicationType`, `CommunicationChannel`, `CommunicationStatus`, `CommunicationMessageType`, `BehaviourType`, `BehaviourSeverity`, `StudentDocumentType` (CERTIFICATE, MEDICAL, AADHAAR, APAAR, BIRTH_CERTIFICATE, CASTE_CERTIFICATE, TRANSFER_CERTIFICATE, BONAFIDE, REPORT_CARD, PHOTO, etc.)

---

### ☑ Data Dictionary

| Field Pattern | Type | Usage |
|--------------|------|-------|
| `*Id` | UUID (String) | All primary keys are UUIDs |
| `schoolId` | UUID (FK) | Tenant isolation — every business record carries this |
| `*Amount` / `totalAmount` / `paidAmount` | Decimal(12,2) | Currency values in INR |
| `attendanceValue` | Decimal(3,2) | `1.00` = Present/Late, `0.50` = Half Day, `0.00` = Absent |
| `percentage` | Decimal(5,2) | Exam/attendance percentages |
| `marksObtained` / `maxMarks` | Decimal(6,2) | Exam marks |
| `*Hash` (passwordHash, tokenHash) | String | bcrypt hashed values |
| `createdAt` / `updatedAt` | DateTime | Auto-managed timestamps |
| `isActive` | Boolean | Soft delete flag |
| `status` | Enum | State machine (PENDING → PARTIAL → PAID, etc.) |

---

### ☑ Seed / Sample Data Scripts

| File | Purpose |
|------|---------|
| `backend/prisma/seed.ts` (392 lines) | Main seed script — creates 1 school, 1 principal, 1 admin, 14 teachers, 24 classes (1A-12B), ~600+ students, fee structures, payments, receipts, exams, exam results, 20 days attendance |
| `backend/prisma/seed-april-attendance.ts` | Supplemental attendance seed for April |

**Seed Credentials**:
- Principal: `principal@smartshala.local` / `SmartShala@123`
- Admin: `admin@smartshalaahmedabad.edu.in` / `SmartShala@123`
- All teachers share password: `SmartShala@123`

**Run**: `cd backend && npm run seed`

---

### ☑ Database Migration Files

29 migrations in `backend/prisma/migrations/` (chronological):

| Migration | Description |
|-----------|-------------|
| `20260421000000_day1_foundation` | Core schema: School, User, Class, Student, Attendance, Fees, Payments, Receipts, Notifications |
| `20260423000000_fee_management_indexes` | Performance indexes for fee queries |
| `20260501000000_student_performance_metric` | Performance rate, classification fields |
| `20260501001000_academic_analytics_models` | Exam, ExamResult, Subject models |
| `20260501002000_homework_tracking` | HomeworkAssignment, HomeworkSubmission |
| `20260502000000_communication_logs` | CommunicationLog model |
| `20260502001000_behaviour_tracking` | BehaviourRecord model |
| `20260502002000_student_document_storage` | StudentDocument model |
| `20260502003000_role_based_access` | Role-based query indexes |
| `20260502004000_teacher_homework_management` | Homework management enhancements |
| `20260503000000_teacher_marks_module` | Marks module refinements |
| `20260503003000_teacher_communication_module` | Communication enhancements |
| `20260504001000_subject_teacher_assignments` | Subject-teacher link |
| `20260504002000_teacher_period_assignments` | Timetable model |
| `20260506000000_homework_assignment_owner` | `assignedById` on HomeworkAssignment |
| `20260508000000_performance_indexes` | Query optimization indexes |
| `20260514000000_payment_references` | UPI, cheque, DD, gateway reference fields |
| `20260514001000_half_day_attendance` | Half-day attendance value (0.5) |
| `20260514002000_whatsapp_template_types` | Communication message type enum |
| `20260515000000_audit_logs` | AuditLog model |
| `20260515001000_guardian_details` | Mother, father, guardian detail fields |
| `20260516000000_exam_term` | ExamTerm enum (UNIT_TEST, MID_TERM, FINAL, etc.) |
| `20260516001000_school_profile_fields` | GSTIN, U-DISE, affiliation board, logo |
| `20260516002000_fee_adjustments` | FeeAdjustment model (concessions/discounts) |
| `20260518010000_class_form_metadata` | Class metadata (stream, medium, max strength) |
| `20260520000000_weekday_timetable_settings` | Timetable period count setting |
| `20260522093000_transport_fee` | Transport fee fields |
| `20260525000000_notification_sent_by` | Notification sender tracking |
| `20260525000001_student_profile_photo` | Student photo URL field |

Master DB migrations at `backend/prisma/master/migrations/`.

**Run Migrations**: `cd backend && npx prisma migrate dev`
**Deploy Migrations**: `cd backend && npx prisma migrate deploy`

---

### ☑ Backup & Restore Procedure

> ⚠️ **NOT FORMALLY DOCUMENTED** — No explicit backup/restore scripts exist in the codebase.

**Current state**:
- Neon PostgreSQL provides point-in-time recovery (PITR) at the infrastructure level.
- The `render-start.mjs` script handles migration deployment with retries.
- Tenant deletion has a 3-day cancellation window before databases are dropped via Neon API.

**Recommended actions for production**:
- Configure Neon's automated backups and retention policy.
- Create a `pg_dump` / `pg_restore` script for manual backups.
- Document the RTO/RPO requirements.

---

## 🔐 SECURITY

### ☑ Authentication & Authorization Flow

```
1. Login: POST /api/auth/login
   ├── Accepts: identifier (email or phone) + password
   ├── Validates credentials via bcrypt.compare()
   ├── Returns: accessToken (JWT, 15min) + refreshToken (JWT, 7days) + user object
   └── Tokens stored in localStorage (client-side)

2. Protected Requests:
   ├── Client sends: Authorization: Bearer <accessToken>
   ├── requireAuth middleware verifies JWT signature
   ├── Extracts: sub (userId), schoolId, tenantSchoolId, role
   ├── Validates tenant mismatch if multi-tenant
   └── Populates req.user

3. Role Authorization:
   ├── requireRole(["PRINCIPAL", "ADMIN"]) middleware
   ├── Checks req.user.role against allowed roles
   └── Returns 403 if not permitted

4. Token Refresh:
   ├── RefreshToken model stores hashed tokens
   ├── Refresh endpoint validates and rotates tokens
   └── Revoked tokens tracked via revokedAt

5. Multi-Tenant Auth:
   ├── tenantMiddleware resolves /:schoolId to master DB record
   ├── Validates school is active and not trial-expired
   ├── Creates tenant-scoped Prisma client via AsyncLocalStorage
   └── JWT contains tenantSchoolId for cross-validation
```

**Session Management**: Client-side localStorage (`smartshala.accessToken`, `smartshala.refreshToken`, `smartshala.user`). On 401 response, tokens are cleared and user is redirected to `/login`.

---

### ☑ Environment Variables List (Keys Only)

#### Backend (`backend/.env`)

| Key | Required | Purpose |
|-----|----------|---------|
| `NODE_ENV` | No (default: development) | Runtime environment |
| `PORT` | No (default: 4000) | Server port |
| `DATABASE_URL` | **Yes** | PostgreSQL pooled connection (Neon) |
| `DIRECT_URL` | No | PostgreSQL direct connection for migrations |
| `MASTER_DATABASE_URL` | No | Master DB for multi-tenant |
| `NEON_API_KEY` | No | Neon API for DB provisioning |
| `NEON_PROJECT_ID` | No | Neon project identifier |
| `NEON_BRANCH_ID` | No | Neon branch identifier |
| `NEON_ROLE_NAME` | No | Neon DB owner role |
| `NEON_DATABASE_URL_TEMPLATE` | No | Template for tenant DB URLs |
| `NEON_DIRECT_URL_TEMPLATE` | No | Template for tenant direct URLs |
| `SUPER_ADMIN_EMAIL` | No | Platform admin email |
| `SUPER_ADMIN_PASSWORD` | No | Platform admin password (plaintext) |
| `SUPER_ADMIN_PASSWORD_HASH` | No | Platform admin password (bcrypt) |
| `JWT_ACCESS_SECRET` | **Yes** (min 24 chars) | Access token signing secret |
| `JWT_REFRESH_SECRET` | **Yes** (min 24 chars) | Refresh token signing secret |
| `ACCESS_TOKEN_EXPIRES_IN` | No (default: 15m) | Access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | No (default: 7d) | Refresh token TTL |
| `FRONTEND_URL` | No (default: http://localhost:3000) | Frontend origin |
| `CORS_ORIGIN` | No (default: http://localhost:3000) | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | No (default: info) | Pino log level |
| `PRISMA_LOG_LEVEL` | No (default: error,warn) | Prisma query logging |
| `DEMO_RESET_ENABLED` | No (default: false) | Enable demo data reset endpoint |
| `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | WhatsApp business phone ID |
| `WHATSAPP_VERIFY_TOKEN` | No | WhatsApp webhook verify token |
| `REDIS_URL` | No | Redis for notification queue |
| `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` | No | Workaround for Render deploy locks |

#### Frontend (`frontend/.env.local`)

| Key | Required | Purpose |
|-----|----------|---------|
| `NEXT_PUBLIC_API_URL` | No (default: http://localhost:4000/api) | Backend API base URL |
| `NEXT_PUBLIC_API_BASE_URL` | No | Alias for API URL |
| `NEXT_PUBLIC_APP_NAME` | No (default: SmartShala) | Application name |

---

### ☑ Third-party Integrations & API Keys List

| Service | Key/Variable | Status | Purpose |
|---------|-------------|--------|---------|
| **Neon PostgreSQL** | `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | Active | Database hosting & tenant provisioning |
| **WhatsApp Cloud API** (Meta) | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Placeholder/Mock | Parent messaging |
| **Redis** | `REDIS_URL` | Placeholder | Notification job queue (not active) |
| **Render** | (deployment platform) | Active | Hosting backend |
| **Unsplash** | (Next.js image config) | Passive | Remote image patterns |

> ⚠️ **No payment gateway** (Razorpay/Cashfree) is integrated. Payment recording is manual and offline.

---

### ☑ Known Vulnerabilities / Pending Security Fixes

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | JWT tokens stored in localStorage (vulnerable to XSS) | Medium | ⚠️ Known — no httpOnly cookie implementation |
| 2 | No CSRF protection (mitigated by Bearer token auth) | Low | ⚠️ Acceptable for API-only backend |
| 3 | Rate limiter is in-memory (`Map`) — resets on server restart, not shared across instances | Medium | ⚠️ Known — needs Redis-backed rate limiting for production scale |
| 4 | Super admin authentication uses bcrypt hash comparison directly in middleware — no JWT flow | Low | ⚠️ By design for platform-level access |
| 5 | No Content Security Policy (CSP) headers configured | Low | ⚠️ Helmet is active but CSP not customized |
| 6 | File uploads stored locally (`uploads/student-documents/`) — no CDN or cloud storage | Medium | ⚠️ Known — needs S3/GCS for production |
| 7 | WhatsApp API tokens in env — no rotation mechanism | Low | ⚠️ Standard for cloud API tokens |
| 8 | No password complexity enforcement beyond min length in Zod | Low | ⚠️ Should add pattern validation |

---

### ☑ Input Validation & Sanitization Approach

- **Validation library**: Zod (^3.23.8) — used at the request boundary
- **Middleware**: `validate.ts` parses `req.body`, `req.query`, and `req.params` using Zod schemas
- **Schema files**: Each module has a `*.schemas.ts` file (e.g., `auth.schemas.ts`, `fees.schemas.ts`, `students.schemas.ts`)
- **Environment validation**: `config/env.ts` validates all env vars with Zod at startup
- **Error handling**: ZodError is caught by `errorHandler.ts` and returns structured 400 responses with field-level messages
- **Sanitization**: Audit middleware redacts sensitive keys (password, token, authorization) from logs
- **SQL injection**: Prevented by Prisma ORM — no raw SQL in the codebase

---

### ☑ Rate Limiting & Brute Force Protection

- **Implementation**: Custom in-memory rate limiter (`middleware/rateLimit.ts`)
- **Storage**: In-memory `Map<string, Bucket>` (not persistent, not distributed)
- **Key**: `{keyPrefix}:{req.ip}` — per-IP rate limiting
- **Configurable**: `windowMs` (time window) and `max` (max requests)
- **Applied to**: Auth login routes (prevents brute force)
- **Response**: HTTP 429 with error code `RATE_LIMITED`

> ⚠️ **Limitation**: In-memory only. Not shared across horizontally scaled instances. For production at scale, migrate to Redis-backed rate limiter.

---

## ⚙️ CODEBASE

### ☑ Source Code Repository Access

- **Platform**: GitHub
- **Repository**: `manav859/CampusLoom`
- **Branch strategy**: ⚠️ *Not formally documented — appears to use main branch development*
- **Commit history**: Full history available in Git

---

### ☑ Folder Structure Document

```
smartshala/
├── .agents/                          # AI agent skills & configuration
│   └── skills/                       # Caveman, cavecrew skills
├── .gitignore
├── .antigravityignore
├── package.json                      # Root monorepo scripts
├── README.md
├── AUDIT_CHANGES.md                  # 553-line audit remediation checklist
├── smartshala_v1_checklist.md         # V1 completion checklist (5 phases)
├── sample-students-import.csv        # Sample CSV for bulk import
│
├── backend/
│   ├── package.json                  # Backend dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config (ES2022, NodeNext)
│   ├── .env.example                  # Environment template
│   ├── prisma/
│   │   ├── schema.prisma             # Tenant DB schema (766 lines, 23 models)
│   │   ├── seed.ts                   # Seed data script (392 lines)
│   │   ├── seed-april-attendance.ts  # April attendance seed
│   │   ├── master/
│   │   │   └── schema.prisma         # Master DB schema (4 models)
│   │   └── migrations/              # 29 migration directories
│   ├── scripts/
│   │   ├── render-start.mjs          # Production start (migrate + start)
│   │   └── register-existing-school.mjs  # Legacy tenant registration
│   ├── src/
│   │   ├── app.ts                    # Express app factory
│   │   ├── server.ts                 # Server bootstrap & shutdown
│   │   ├── config/
│   │   │   ├── env.ts                # Zod-validated environment config
│   │   │   └── logger.ts             # Pino logger setup
│   │   ├── core/
│   │   │   ├── asyncHandler.ts       # Async error wrapper
│   │   │   ├── auditLog.ts           # Audit log helper
│   │   │   ├── errors.ts             # AppError class
│   │   │   ├── grading.ts            # Grade band calculation
│   │   │   ├── pagination.ts         # Pagination helper
│   │   │   ├── prisma.ts             # Prisma client (tenant-aware)
│   │   │   └── studentAttendance.ts  # Single-source attendance calculator
│   │   ├── middleware/
│   │   │   ├── auth.ts               # requireAuth, requireRole
│   │   │   ├── activityAudit.ts      # Auto-audit mutating requests
│   │   │   ├── dbWarmup.ts           # Cold-start DB connection warmup
│   │   │   ├── errorHandler.ts       # Centralized error handling
│   │   │   ├── notFound.ts           # 404 handler
│   │   │   ├── rateLimit.ts          # In-memory rate limiter
│   │   │   ├── tenant.middleware.ts  # Multi-tenant resolver + AsyncLocalStorage
│   │   │   └── validate.ts           # Zod request validation
│   │   ├── modules/                  # 20 feature modules
│   │   │   ├── activity/             # (routes, controller, service)
│   │   │   ├── analytics/
│   │   │   ├── attendance/           # (+ report controller/service, schemas)
│   │   │   ├── auth/                 # (+ schemas)
│   │   │   ├── classes/              # (+ schemas)
│   │   │   ├── communication/        # (+ schemas)
│   │   │   ├── dashboard/
│   │   │   ├── demo/
│   │   │   ├── fees/                 # (+ schemas, receipt-pdf.ts)
│   │   │   ├── homework/             # (+ schemas)
│   │   │   ├── marks/                # (+ schemas)
│   │   │   ├── notifications/        # (+ schemas, whatsapp.service.ts)
│   │   │   ├── onboarding/           # (+ schemas)
│   │   │   ├── reports/
│   │   │   ├── settings/             # (+ schemas)
│   │   │   ├── students/             # (+ schemas)
│   │   │   ├── superAdmin/           # (+ middleware, schemas)
│   │   │   ├── tenantSetup/          # (+ schemas)
│   │   │   ├── users/                # (+ schemas)
│   │   │   └── whatsapp/
│   │   ├── routes/
│   │   │   ├── index.ts              # Central router registration
│   │   │   └── health.ts             # Health check endpoints
│   │   ├── services/
│   │   │   ├── createSchoolDatabase.ts  # Neon DB provisioning
│   │   │   ├── databaseDeletion.service.ts  # Tenant DB deletion
│   │   │   ├── trial.service.ts      # Trial expiry worker
│   │   │   ├── coupon.service.ts     # Coupon validation
│   │   │   └── payment.service.ts    # Payment helpers
│   │   ├── tenant/
│   │   │   ├── tenantContext.ts       # AsyncLocalStorage for tenant
│   │   │   ├── tenantResolver.ts      # Resolves schoolId to DB URL
│   │   │   ├── prismaManager.ts       # Tenant Prisma client pool
│   │   │   └── legacyTenant.ts        # Legacy single-tenant compat
│   │   ├── master-db/
│   │   │   └── masterPrisma.ts        # Master DB Prisma client
│   │   ├── lib/                       # (internal utilities)
│   │   ├── types/                     # TypeScript type extensions
│   │   ├── utils/
│   │   │   └── generateSchoolId.ts    # 8-char school ID generator
│   │   └── generated/                 # Prisma generated client (gitignored)
│   ├── tests/                        # Test files (5 test suites)
│   ├── uploads/
│   │   └── student-documents/         # File upload storage
│   └── dist/                          # Compiled JS output
│
├── frontend/
│   ├── package.json                  # Frontend dependencies & scripts
│   ├── tsconfig.json
│   ├── next.config.ts                # Next.js config (strict mode, unsplash images)
│   ├── tailwind.config.ts            # Apple-inspired design tokens
│   ├── postcss.config.js
│   ├── .env.example
│   ├── public/                       # Static assets
│   └── src/
│       ├── middleware.ts             # Next.js middleware (tenant URL rewriting)
│       ├── app/
│       │   ├── globals.css           # Global CSS (12KB design system)
│       │   ├── layout.tsx            # Root layout
│       │   ├── page.tsx              # Root redirect
│       │   ├── (auth)/login/         # Login page
│       │   ├── (app)/                # Authenticated app shell
│       │   │   ├── layout.tsx        # App layout (sidebar + auth guard)
│       │   │   ├── dashboard/        # Principal/teacher dashboard
│       │   │   ├── students/         # Student list, detail, create, edit
│       │   │   ├── teachers/         # Teacher list, create, edit
│       │   │   ├── classes/          # Class grid
│       │   │   ├── attendance/       # Attendance marking & reports
│       │   │   ├── fees/             # Fee dashboard, ledger, defaulters
│       │   │   ├── notifications/    # WhatsApp logs
│       │   │   ├── analytics/        # Risk insights
│       │   │   ├── reports/          # Reports page
│       │   │   ├── settings/         # School settings
│       │   │   ├── activity-logs/    # Audit log viewer
│       │   │   └── teacher/          # Teacher-specific pages
│       │   │       ├── classes/      # My Classes
│       │   │       ├── homework/     # Homework management
│       │   │       ├── marks/        # Exam & marks entry
│       │   │       └── communication/# Parent communication
│       │   ├── [schoolId]/           # Multi-tenant routes
│       │   │   ├── login/            # Tenant login
│       │   │   ├── receipt/          # Receipt view
│       │   │   ├── school-not-found/ # 404 for invalid school
│       │   │   └── subscription-expired/
│       │   ├── onboard/              # Onboarding page
│       │   ├── onboarding-success/
│       │   ├── trial-activated/
│       │   ├── payment-pending/
│       │   ├── school-inactive/
│       │   ├── super-admin/          # Super admin panel
│       │   └── receipt/              # Public receipt view
│       ├── components/
│       │   ├── layout/               # Sidebar, AuthGuard, etc.
│       │   ├── ui/                   # StatusPill, reusable UI components
│       │   ├── dashboard/            # Dashboard-specific components
│       │   ├── fees/                 # Fee-specific components
│       │   ├── AttendanceList.tsx
│       │   ├── AttendanceSummary.tsx
│       │   └── StudentRow.tsx
│       ├── features/
│       │   ├── attendance/           # Attendance feature logic
│       │   ├── auth/                 # Auth feature logic
│       │   ├── dashboard/            # Dashboard feature logic
│       │   └── reports/              # Reports feature logic
│       ├── hooks/
│       │   └── useAttendance.ts      # Attendance state management hook
│       ├── lib/
│       │   ├── api.ts                # API client (1213 lines, 50+ endpoints)
│       │   ├── env.ts                # Environment config
│       │   ├── tenant.ts             # Tenant URL helpers
│       │   ├── formatters.ts         # INR currency, date formatting
│       │   ├── communicationTemplates.ts  # WhatsApp message templates
│       │   └── prefetchCache.ts      # Client-side data prefetching
│       └── types/
│           └── index.ts              # SessionUser, Role, Kpi types
│
└── docs/
    ├── api/
    │   └── api-plan.md               # API endpoint reference
    ├── architecture/
    │   ├── system-overview.md         # System architecture overview
    │   └── multi-tenant-onboarding.md # Multi-tenant design doc
    ├── database/
    │   ├── schema-notes.md            # Schema design notes
    │   └── neon-migration.md          # Neon migration guide
    ├── product/
    │   └── v1-scope.md                # V1 scope document
    └── setup/
        └── local-development.md       # Local dev setup guide
```

---

### ☑ Coding Standards / Conventions Used

| Convention | Detail |
|-----------|--------|
| **Language** | TypeScript (strict mode) throughout |
| **Module system** | ES Modules (`"type": "module"` in backend) |
| **Target** | ES2022 (backend), Next.js default (frontend) |
| **Module pattern** | Each feature module: `module.routes.ts` → `module.controller.ts` → `module.service.ts` → `module.schemas.ts` |
| **Naming** | camelCase for variables/functions, PascalCase for types/models, SCREAMING_SNAKE for enums |
| **File naming** | kebab-case for middleware/utils, camelCase for modules |
| **API style** | RESTful with consistent JSON error format: `{ error: { code, message, details? } }` |
| **Database IDs** | UUIDs throughout (no auto-increment) |
| **Tenant isolation** | Every query scoped by `schoolId` |
| **Error handling** | Custom `AppError` class with status code, message, and error code |
| **Validation** | Zod schemas at request boundary |
| **Logging** | Pino structured JSON logging |

---

### ☑ Third-party Libraries & Licenses List

#### Backend Dependencies

| Package | Version | License |
|---------|---------|---------|
| @prisma/client | ^5.22.0 | Apache-2.0 |
| bcryptjs | ^2.4.3 | MIT |
| cors | ^2.8.5 | MIT |
| dotenv | ^16.4.5 | BSD-2-Clause |
| express | ^4.21.1 | MIT |
| helmet | ^8.0.0 | MIT |
| jsonwebtoken | ^9.0.2 | MIT |
| morgan | ^1.10.1 | MIT |
| multer | ^2.1.1 | MIT |
| pdfkit | ^0.18.0 | MIT |
| pino | ^9.4.0 | MIT |
| pino-http | ^10.3.0 | MIT |
| zod | ^3.23.8 | MIT |
| prisma | ^5.22.0 | Apache-2.0 |
| tsx | ^4.19.2 | MIT |
| typescript | ^5.6.3 | Apache-2.0 |
| pino-pretty | ^11.3.0 | MIT |

#### Frontend Dependencies

| Package | Version | License |
|---------|---------|---------|
| next | ^15.0.3 | MIT |
| react | ^19.0.0 | MIT |
| react-dom | ^19.0.0 | MIT |
| framer-motion | ^12.38.0 | MIT |
| recharts | ^3.8.1 | MIT |
| tailwindcss | ^3.4.15 | MIT |
| typescript | ^5.6.3 | Apache-2.0 |
| autoprefixer | ^10.4.20 | MIT |
| postcss | ^8.4.49 | MIT |
| eslint | ^9.15.0 | MIT |

> All dependencies use permissive licenses (MIT, Apache-2.0, BSD-2-Clause). No copyleft (GPL) dependencies detected.

---

### ☑ Unfinished Features / Known Bugs List

#### Unfinished Features (from `smartshala_v1_checklist.md`)

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 3 | Fee reminder scheduler (cron/job) | ❌ Not started |
| Phase 3 | Automated reminders (7 days before, due day, overdue) | ❌ Not started |
| Phase 3 | Defaulter detection automation | ❌ Not started |
| Phase 3 | Attendance alerts (<75%) automation | ❌ Not started |
| Phase 3 | Class-level attendance alerts | ❌ Not started |
| Phase 3 | Bulk WhatsApp fee reminders | ❌ Not started |
| Phase 4 | PDF export for reports | ❌ Not started |
| Phase 4 | Monthly attendance PDF reports | ❌ Not started |
| Phase 4 | Fee collection vs target reports | ❌ Not started |
| Phase 4 | Defaulter report export | ❌ Not started |
| Phase 5 | At-risk student scoring (rule-based AI) | ❌ Not started |
| Phase 5 | Combined attendance + fees risk signals | ❌ Not started |
| Phase 5 | Red/amber/green alert system | ❌ Not started |
| Phase 5 | Dashboard AI insights | ❌ Not started |

#### Known Incomplete Items (from `AUDIT_CHANGES.md`)

| Item | Status |
|------|--------|
| Staff phone OTP sign-in | ❌ Optional, not started |
| "Saved - 9:45 AM" timestamp on attendance save | ❌ Not done |
| Absent reason capture (Sick, Family, Other) | ❌ Not done |
| "Lock after submit" for exam marks | ❌ Not done |
| Scheduled send date/time for WhatsApp | ❌ Not done |
| "Generate invoice" for fee structures | ❌ Not done |
| Year-on-year fee history | ❌ Not done |
| Show next receipt number before recording | ❌ Not done |
| Seed realistic class averages and ranks | ❌ Not done |
| Component library full refactor | ❌ Partial |
| Hindi locale pass (i18n) | ❌ Partial (templates only) |
| Complete accessibility pass | ❌ Partial |
| Mobile/responsive for top 5 workflows | ❌ Unknown status |

#### Known Bugs

| # | Bug | Severity |
|---|-----|----------|
| 1 | ⚠️ **No known critical bugs** — the attendance source-of-truth bug was fixed (per checklist) | — |
| 2 | Frontend middleware rewrite may have edge cases with nested tenant paths | Low |
| 3 | DB warmup scheduler uses `setInterval` — could leak timers on hot reload in dev | Very Low |

---

## 🚀 DEPLOYMENT & DEVOPS

### ☑ Deployment Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                   RENDER.COM                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │        Backend Web Service                    │    │
│  │  Build: npm run prisma:generate:all && tsc    │    │
│  │  Start: node scripts/render-start.mjs         │    │
│  │    1. Deploy master DB migrations             │    │
│  │    2. Deploy tenant DB migrations (5 retries) │    │
│  │    3. Start node dist/server.js               │    │
│  └─────────────────┬────────────────────────────┘    │
│                    │                                  │
│  ┌─────────────────┴────────────────────────────┐    │
│  │        Frontend (presumed Vercel/Render)       │    │
│  │  Build: next build                            │    │
│  │  Start: next start                            │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│               NEON POSTGRESQL (Cloud)                 │
│   master_db + school_* tenant databases              │
│   Pooled connections (pgbouncer)                     │
│   Direct connections (for migrations)                │
└──────────────────────────────────────────────────────┘
```

---

### ☑ CI/CD Pipeline Documentation

> ⚠️ **No CI/CD pipeline is configured in the repository.** There are no GitHub Actions workflows, Jenkinsfiles, or similar CI/CD configuration files.

**Current deployment**: Appears to be **Render auto-deploy** triggered by GitHub pushes.

**Recommended**:
- Add GitHub Actions for: lint, type-check, test, build
- Add preview deployments for PRs
- Add production deployment gate with approval

---

### ☑ Server & Hosting Configuration Details

| Component | Platform | Details |
|-----------|----------|---------|
| **Backend** | Render.com | Web Service, Node.js |
| **Frontend** | ⚠️ *Not explicitly documented* — likely Render or Vercel | Next.js SSR/SSG |
| **Database** | Neon PostgreSQL | Serverless, us-east-1, pooled + direct endpoints |
| **File Storage** | Local filesystem (`uploads/`) | ⚠️ Ephemeral on Render — needs S3/GCS |
| **DNS** | ⚠️ *Not documented* | — |
| **SSL** | Managed by hosting platform | — |

---

### ☑ Docker / Containerization Files

> ⚠️ **No Docker files exist.** No `Dockerfile`, `docker-compose.yml`, or `.dockerignore` found in the repository.

The project uses Render's native Node.js buildpacks.

---

### ☑ Environment Setup Guide (Local Dev)

```bash
# Prerequisites: Node.js 20+, PostgreSQL 14+ (or Neon account), npm

# 1. Clone the repository
git clone https://github.com/manav859/CampusLoom.git
cd CampusLoom/smartshala

# 2. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL/Neon credentials and JWT secrets

# Generate Prisma clients
npm run prisma:generate:all

# Run migrations
npm run prisma:migrate -- --name init

# Seed demo data
npm run seed

# Start backend (dev mode with hot reload)
npm run dev
# → http://localhost:4000/api/v1

# 3. Frontend setup (in a new terminal)
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local if backend is not on localhost:4000

# Start frontend
npm run dev
# → http://localhost:3000

# 4. Login with demo credentials
#    Email: principal@smartshala.local
#    Password: SmartShala@123
```

---

### ☑ Domain, DNS & SSL Certificate Details

> ⚠️ **Not documented in the repository.** Domain, DNS, and SSL configuration details are managed outside the codebase (likely at the Render/DNS provider level).

---

## 🧪 TESTING

### ☑ Manual Test Cases Document

> ⚠️ **No formal manual test cases document exists.** However, the `AUDIT_CHANGES.md` (553 lines) serves as a de facto acceptance checklist with screen-by-screen verification items.

The `docs/database/neon-migration.md` contains a validation checklist:
- `npm run prisma:generate`
- `npx prisma migrate status`
- Login APIs
- Demo principal login
- Student/class/attendance/fees CRUD flows
- Dashboard and analytics queries
- `/health/db` returns `status: ok`

---

### ☑ Existing Automated Tests & How to Run Them

| Test File | Run Command | What It Tests |
|-----------|-------------|---------------|
| `tests/grading.test.ts` | `npm run test:grading` | Grade band calculation (A+, A, B, C, D, F) |
| `tests/studentAttendance.test.ts` | `npm run test:attendance` | Student attendance percentage calculation (single source of truth) |
| `tests/marksExamTerm.test.ts` | `npm run test:marks-term` | Marks and exam term validation |
| `tests/feeAdjustmentSchema.test.ts` | `npm run test:fee-adjustment` | Fee adjustment Zod schema validation |
| `tests/paymentReferences.test.ts` | (no npm script) | Payment reference field validation |

**Test runner**: `tsx` (direct TypeScript execution, no Jest/Vitest framework)
**Run all**: No single `npm test` command configured — tests must be run individually.

> ⚠️ **Test coverage is minimal.** Only 5 test files exist, focused on utility/schema validation. No integration tests, no API endpoint tests, no frontend tests.

---

### ☑ Test Coverage Report

> ⚠️ **No test coverage tooling is configured.** No `jest.config`, `vitest.config`, or coverage reporter setup exists.

**Estimated coverage**: Very low (<5% of codebase). Only utility functions and schemas are tested.

---

### ☑ UAT Results

> ⚠️ **No formal UAT document exists.** The `AUDIT_CHANGES.md` documents a product audit with a score of **6.8/10**, targeting **8.5/10** after fixes. Many audit items are marked as completed (✅).

---

### ☑ Browser & Device Compatibility Notes

> ⚠️ **No formal compatibility testing document exists.**

**Inferred from codebase**:
- **Target browsers**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **CSS**: Tailwind CSS with PostCSS/Autoprefixer — standard browser support
- **Mobile**: Responsive layouts mentioned in audit but status is ⚠️ *unclear*
- **Frameworks**: React 19 + Next.js 15 — requires modern JavaScript engines

---

## 📡 APIs & INTEGRATIONS

### ☑ API Documentation

**Base URL**: `http://localhost:4000/api` or `http://localhost:4000/api/v1`
**Multi-tenant**: `http://localhost:4000/:schoolId/api`
**Auth**: `Authorization: Bearer <accessToken>` on all protected endpoints

#### Complete API Endpoint List (from routes/index.ts and modules)

| Method | Endpoint | Auth | Module | Description |
|--------|----------|------|--------|-------------|
| GET | `/health` | ❌ | health | API health check |
| GET | `/health/db` | ❌ | health | Database connectivity check |
| POST | `/onboarding` | ❌ | onboarding | Register new school (multi-tenant) |
| GET | `/onboarding/coupon-preview?code=` | ❌ | onboarding | Preview coupon discount |
| POST | `/super-admin/login` | ❌ | superAdmin | Platform admin login |
| GET | `/super-admin/schools` | Super Admin | superAdmin | List all schools |
| PATCH | `/super-admin/schools/:schoolId` | Super Admin | superAdmin | Update school status |
| GET | `/super-admin/password-resets` | Super Admin | superAdmin | List password reset requests |
| POST | `/tenant-setup/deletion/*` | ✅ | tenantSetup | Tenant deletion management |
| POST | `/auth/register` | ❌ | auth | User registration |
| POST | `/auth/login` | ❌ | auth | Login (email/phone + password) |
| POST | `/auth/forgot-password` | ❌ | auth | Forgot password request |
| GET | `/auth/me` | ✅ | auth | Current user session |
| POST | `/auth/logout` | ✅ | auth | Logout |
| GET | `/activity-logs` | ✅ | activity | Audit log list |
| GET | `/users` | ✅ | users | List staff users |
| POST | `/users` | ✅ | users | Create staff user |
| PATCH | `/users/:id` | ✅ | users | Update user |
| DELETE | `/users/:id` | ✅ | users | Deactivate user |
| GET | `/classes` | ✅ | classes | List classes |
| POST | `/classes` | ✅ | classes | Create class |
| GET | `/classes/:id` | ✅ | classes | Class detail with roster |
| PATCH | `/classes/:id` | ✅ | classes | Update class |
| DELETE | `/classes/:id` | ✅ | classes | Delete class |
| GET | `/classes/:id/stats` | ✅ | classes | Class KPI stats |
| GET | `/communication/*` | ✅ | communication | Communication logs & context |
| POST | `/communication/messages` | ✅ | communication | Send communication |
| GET | `/students` | ✅ | students | List students (role-filtered) |
| POST | `/students` | ✅ | students | Create student |
| GET | `/students/:id` | ✅ | students | Student detail (7-tab profile) |
| PATCH | `/students/:id` | ✅ | students | Update student |
| DELETE | `/students/:id` | ✅ | students | Deactivate student |
| POST | `/students/:id/documents` | ✅ | students | Upload document |
| GET | `/students/:id/documents/:docId/download` | ✅ | students | Download document |
| POST | `/students/:id/behaviour` | ✅ | students | Log behaviour record |
| GET | `/attendance/roster` | ✅ | attendance | Get attendance roster |
| POST | `/attendance/mark` | ✅ | attendance | Submit attendance |
| GET | `/attendance/daily` | ✅ | attendance | Daily attendance report |
| GET | `/attendance/dashboard` | ✅ | attendance | Attendance dashboard |
| GET | `/attendance/classes-today` | ✅ | attendance | Today's class status |
| GET | `/attendance/monthly` | ✅ | attendance | Monthly calendar view |
| GET | `/homework/context` | ✅ | homework | Teacher's class/subject context |
| GET | `/homework/assignments` | ✅ | homework | List assignments |
| POST | `/homework/assignments` | ✅ | homework | Create assignment |
| GET | `/homework/assignments/:id` | ✅ | homework | Assignment detail with submissions |
| PATCH | `/homework/assignments/:id/submissions` | ✅ | homework | Update submission statuses |
| GET | `/marks/context` | ✅ | marks | Teacher's class/subject/student context |
| GET | `/marks/exams` | ✅ | marks | List exams |
| POST | `/marks/exams` | ✅ | marks | Create exam with marks |
| GET | `/marks/exams/:id` | ✅ | marks | Exam detail with results |
| PATCH | `/marks/exams/:id` | ✅ | marks | Update marks |
| GET | `/fees/dashboard` | ✅ | fees | Fee collection dashboard |
| GET | `/fees/structures` | ✅ | fees | List fee structures |
| POST | `/fees/structures` | ✅ | fees | Create fee structure |
| PATCH | `/fees/structures/:id` | ✅ | fees | Update fee structure |
| POST | `/fees/assignments` | ✅ | fees | Assign fees to students |
| POST | `/fees/payments` | ✅ | fees | Record payment |
| GET | `/fees/students/:id/ledger` | ✅ | fees | Student fee ledger |
| GET | `/fees/defaulters` | ✅ | fees | Defaulter list |
| POST | `/fees/adjustments` | ✅ | fees | Record fee adjustment |
| GET | `/fees/receipts/:id/pdf` | ✅ | fees | Download receipt PDF |
| GET | `/dashboard` | ✅ | dashboard | Dashboard KPIs and data |
| GET | `/analytics/*` | ✅ | analytics | Risk analytics |
| GET | `/reports/*` | ✅ | reports | Reports data |
| GET | `/settings` | ✅ | settings | School settings |
| PATCH | `/settings` | ✅ | settings | Update settings |
| GET | `/notifications` | ✅ | notifications | Notification logs |
| POST | `/wa/send` | ✅ | whatsapp | Send WhatsApp message |
| POST | `/wa/bulk` | ✅ | whatsapp | Bulk WhatsApp send |
| POST | `/wa/logs/:id/retry` | ✅ | whatsapp | Retry failed message |

> ⚠️ **No Swagger/OpenAPI spec or Postman collection exists.** API documentation is partially available in `docs/api/api-plan.md` but is incomplete.

---

### ☑ Webhook Configurations

- **WhatsApp Webhook**: `WHATSAPP_VERIFY_TOKEN` is configured for webhook verification, but the webhook handler implementation is ⚠️ *not confirmed in the whatsapp module*.
- No other webhook integrations exist.

---

### ☑ Third-party Service Accounts List

| Service | Account Type | Purpose |
|---------|-------------|---------|
| Neon PostgreSQL | Cloud database | Managed PostgreSQL for all databases |
| Meta (WhatsApp Cloud API) | Business API | Parent messaging (placeholder) |
| Render.com | Hosting | Backend deployment |
| GitHub | Repository | Source code hosting |

---

### ☑ Integration Flow Diagrams

#### School Onboarding Flow
```
User fills form on /onboard
         │
         ▼
POST /api/onboarding
         │
         ├── Validate input (Zod)
         ├── Check coupon (if provided)
         ├── Generate 8-char school ID
         ├── Neon API: Create database "school_{id}"
         ├── Prisma: Run tenant migrations
         ├── Seed principal account
         ├── Master DB: Create School record
         ├── Master DB: Log onboarding event
         └── Return: { schoolId, loginUrl }
                     │
                     ▼
            Redirect to /:schoolId/login
```

#### Payment & Receipt Flow
```
Admin records payment
         │
         ▼
POST /api/fees/payments
         │
         ├── Validate payment data (amount, mode, references)
         ├── Update StudentFeeAssignment (paidAmount, pendingAmount, status)
         ├── Create Payment record
         ├── Generate receipt number (REC-YYYY-NNNNN)
         ├── Create Receipt record
         ├── (Optional) Queue WhatsApp receipt notification
         └── Return: { payment, receipt, ledger, receiptNotificationQueued }
                     │
                     ▼
            Frontend shows receipt + download PDF option
```

---

## 📊 PERFORMANCE

### ☑ Expected Load & Concurrent User Estimates

> ⚠️ **No formal load testing or capacity planning document exists.**

**Estimated per-school usage** (typical Indian school):
- 20-50 staff users (teachers, admin, principal)
- 500-2000 students (no login in V1)
- Peak concurrent users: 10-30 per school
- Peak times: 8-10 AM (attendance), 3-5 PM (fee collection)

---

### ☑ Known Performance Bottlenecks

| # | Bottleneck | Mitigation Applied |
|---|-----------|-------------------|
| 1 | **Bulk marks entry** — per-student upsert caused Prisma transaction timeout | ✅ Fixed: Replaced with bulk insert transaction |
| 2 | **Attendance submission** — per-student upsert timeout on remote Postgres | ✅ Fixed: Replaced with bulk delete/create writes |
| 3 | **Neon cold starts** — first request after idle fails | ✅ Fixed: DB warmup middleware with scheduled pings |
| 4 | **Prisma migration locks** — advisory lock timeout on Render | ✅ Fixed: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` + retry logic |
| 5 | **Large student detail query** — single endpoint returns 7 tabs of data | ⚠️ Partially mitigated with conditional joins based on role |
| 6 | **No connection pooling management** — relies on Neon's built-in pgbouncer | ⚠️ Acceptable for current scale |

---

### ☑ Caching Strategy Details

- **Backend**: No Redis cache or in-memory cache layer
- **Frontend**: 
  - `prefetchCache.ts` — client-side data prefetching with TTL-based cache
  - API calls use `cache: "no-store"` (no browser caching)
  - GET requests have automatic retry with exponential backoff (max 2 retries)
- **Database**: Neon connection pooling via pgbouncer

> ⚠️ **No server-side caching is implemented.** For production scale, consider Redis for: session data, dashboard KPIs, frequently accessed class/student lists.

---

### ☑ File / Media Storage Details

| Storage Type | Location | Details |
|-------------|----------|---------|
| Student documents | `backend/uploads/student-documents/` | Local filesystem |
| School logos | ⚠️ *URL-based reference in DB* | `logoUrl` field on School model |
| Student photos | ⚠️ *URL-based reference in DB* | `profilePhotoUrl` field on Student model |
| Upload limits | Multer default + `express.json({ limit: "1mb" })` | 1MB JSON, Multer default for files |
| Accepted types | PDF, JPG, PNG | Validated on frontend ("PDF, JPG, PNG up to 5MB") |

> ⚠️ **Critical for production**: Local file storage is **ephemeral on Render**. Files will be lost on redeploy. Migrate to S3/GCS/Cloudflare R2.

---

## 📋 BUSINESS & COMPLIANCE

### ☑ Privacy Policy & Terms of Service

> ⚠️ **No privacy policy or terms of service documents exist in the codebase.** These need to be created before commercial launch, especially for Indian market (DPDP Act compliance).

---

### ☑ Data Retention Policy

> ⚠️ **No formal data retention policy exists.** Current behavior:
- Student records use soft delete (`isActive: false`)
- User records use soft delete (`status: INACTIVE`)
- Audit logs are append-only (never deleted)
- Tenant databases can be deleted with 3-day cancellation window
- No automated data purge or archival

---

### ☑ Payment Flow Documentation

**Payment is offline / manual** — no online payment gateway is integrated.

| Step | Action |
|------|--------|
| 1 | Admin/Accountant opens student fee ledger |
| 2 | Clicks "Record Payment" |
| 3 | Enters: amount, payment mode (Cash/UPI/Cheque/DD/Bank Transfer/Online Gateway), reference details |
| 4 | Backend: Creates Payment → Updates StudentFeeAssignment → Creates Receipt → (Optional) Queues WhatsApp notification |
| 5 | Receipt PDF can be downloaded or shared via WhatsApp |
| 6 | Fee adjustments (concessions/discounts) can be applied separately |

**Payment modes**: Cash, UPI (transaction ID), Bank Transfer (bank reference), Cheque (cheque number), DD (DD number), Online Gateway (gateway transaction ID), Other.

> ⚠️ **Razorpay/Cashfree integration is planned but not implemented.** Payment simulation is used for onboarding.

---

### ☑ Compliance Requirements

| Requirement | Status |
|------------|--------|
| **DPDP Act (India)** | ⚠️ Not addressed — no consent management, data portability, or DPO designation |
| **Student data protection** | Partial — soft deletes, audit logs, role-based access |
| **GSTIN on receipts** | ✅ Supported — School model has `gstin` field |
| **U-DISE compliance** | ✅ School model has `udiseNumber` field |
| **CBSE/Board affiliation** | ✅ School model has `affiliationBoard` field |
| **Aadhaar/APAAR storage** | ✅ StudentDocument supports AADHAAR and APAAR types |
| **Data encryption at rest** | ⚠️ Managed by Neon PostgreSQL (infrastructure level) |
| **Data encryption in transit** | ✅ SSL/TLS enforced (`sslmode=require`) |
| **Audit trail** | ✅ AuditLog model with before/after JSON snapshots |
| **Password hashing** | ✅ bcrypt with 10 salt rounds |

---

## 📞 HANDOVER SPECIFIC

### ☑ Handover Notes / Transition Summary

**Project Maturity**: V1 is feature-complete for core school operations (Phase 0-2). Phase 3-5 (automation, reports, AI) are not started.

**Architecture Quality**: Well-structured modular backend with 20 feature modules. Multi-tenant architecture is functional. Frontend uses modern Next.js 15 App Router.

**Code Quality**: TypeScript strict mode throughout, Zod validation, Prisma ORM, structured logging. Code is well-organized but test coverage is minimal.

**Design**: Apple-inspired glassmorphism UI with Tailwind CSS. Design system is partially implemented in CSS variables and Tailwind config.

**Key Strengths**:
- WhatsApp-first communication (unique differentiator)
- Multi-tenant database isolation (Neon PostgreSQL)
- Comprehensive student profile (7 tabs)
- Role-based access control
- Audit trail infrastructure
- Indian-school context (INR, CBSE, Aadhaar, U-DISE)

**Key Gaps**:
- No CI/CD pipeline
- Minimal test coverage (<5%)
- No containerization (Docker)
- Local file storage (not cloud-ready)
- No online payment gateway
- No parent portal/app
- No formal documentation (Swagger, Postman)
- No privacy policy / DPDP compliance

---

### ☑ Known Risks & Open Issues

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **File storage is local** — lost on Render redeploy | HIGH | Migrate to S3/GCS immediately |
| 2 | **No CI/CD** — manual deploys risk regressions | MEDIUM | Add GitHub Actions |
| 3 | **Rate limiter is in-memory** — ineffective at scale | MEDIUM | Migrate to Redis |
| 4 | **JWT in localStorage** — XSS vulnerability | MEDIUM | Consider httpOnly cookies |
| 5 | **No automated test suite** — changes may break | MEDIUM | Add integration/E2E tests |
| 6 | **WhatsApp API is placeholder** — not production-verified | LOW | Verify with real Meta Business API credentials |
| 7 | **No backup/restore procedure** — relies on Neon PITR | LOW | Document and test restore procedure |
| 8 | **Single-region deployment** — no disaster recovery | LOW | Add multi-region when scale justifies |

---

### ☑ Common Issues & Fix Guide

| Issue | Cause | Fix |
|-------|-------|-----|
| "Something went wrong" on first request after cold start | Neon DB wakes from sleep | Wait 2-3 seconds; DB warmup middleware auto-retries |
| `P1001` / `P1002` errors | Neon connection issue | Verify DATABASE_URL, check Neon branch is active |
| `P2024` pool exhausted | Too many concurrent connections | Reduce concurrency or increase Neon pool limits |
| Migration lock timeout | Advisory lock contention | Set `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` |
| Login works locally but fails on Render | JWT secrets or CORS mismatch | Ensure Render has same JWT secrets and FRONTEND_URL |
| Attendance submission timeout | Bulk upsert on remote Postgres | Already fixed — uses bulk delete/create |
| Marks saving timeout | Per-student upsert transaction | Already fixed — uses bulk insert |
| Tenant 404 "School not found" | Invalid school ID format | School IDs must be 8-character alphanumeric uppercase |

---

### ☑ Vendor & Subscription List

| Vendor | Service | Estimated Cost | Renewal |
|--------|---------|---------------|---------|
| **Neon** | PostgreSQL database | Free tier → Paid (scale-based) | Monthly |
| **Render** | Backend hosting | Free tier → Paid ($7+/mo) | Monthly |
| **Meta (WhatsApp)** | Business API | Per-conversation pricing | As-used |
| **GitHub** | Repository hosting | Free (public) or paid (private) | Monthly/Annual |
| **npm** | Package registry | Free | N/A |

> ⚠️ Specific plan details and renewal dates are not available in the codebase.

---

### ☑ Relevant Contacts List

> ⚠️ **No contacts list exists in the codebase.** The repository owner is `manav859` on GitHub.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed / Available |
| ⚠️ | Missing, incomplete, or needs attention |
| ❌ | Not implemented / Not started |
