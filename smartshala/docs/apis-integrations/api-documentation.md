# API Documentation

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
