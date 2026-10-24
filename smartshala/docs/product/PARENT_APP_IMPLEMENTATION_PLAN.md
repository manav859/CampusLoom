# SmartShala — Parent App Implementation Plan

**Created:** 2026-10-23
**Status:** **Phases 0–5 complete in code (Phase 5 on 2026-10-24).** Phase 0: the `parent` flavor builds on Android and is wired on iOS. Phase 1: parent login + Select Student. Phase 2: Home + Attendance. Phase 3: Academics (exam performance) + Homework. Phase 4: Fees & online payment (external Razorpay web flow). Phase 5: Calendar, Announcements (read-only) + Documents — the five-tab shell is now fully built. The backend is **live on production** — the VPS now auto-deploys from `main` (GitHub Actions → `deploy.sh`). Phase 6 (push notifications) is next.
**Design reference:** the 10-screen parent-dashboard mockup shared on 2026-10-23 — **reference only, not to be replicated pixel-for-pixel**. The parent app uses the **same design tokens, Inter font, `CustomSelect`, `BrandHeader`, pastel KPI cards and 6/8px radii** already shared across the Principal and Teacher apps (`mobile/lib/core/`), not the mockup's own icons, colours or avatars.
**Scope:** a third Flutter binary — **SmartShala Parent** — for **Android and iOS**, built phase-wise.

---

## 0. The one thing that makes this different from the Principal/Teacher apps

The Principal and Teacher apps were thin clients over an API that **already existed** for the web dashboard. The Parent app is not. Today:

- `UserRole.PARENT` exists in the Prisma enum (`backend/prisma/schema.prisma:698`) but is **never created, never issued a token, and never used to scope a query**.
- A `Student` carries `parentName` / `parentPhone` / `fatherPhone` / `motherPhone` as **plain strings** (`schema.prisma:178`). There is **no relation from a `User` to the students they parent.**
- There is **no parent login path**, **no `/parent/*` or `/me/children` endpoints**, and **no parent portal on the web** (confirmed: nothing under `frontend/src/app` serves parents).
- Login is `identifier` + `password` (`auth.schemas.ts`), issued only to staff roles.

**Consequence:** roughly half this project is backend. The app phases below each name the backend work they depend on. We build the parent-access layer on the server first, then the client reads it.

> This is also an opportunity: because there is no legacy parent API, we design it once, cleanly, for mobile.

---

## 1. Decisions already locked (inherited from the V2 apps)

| Area | Decision |
|---|---|
| Stack | **Flutter**, one codebase / multiple binaries. The Parent app is a **third flavor**: `AppFlavor.parent`, `lib/main_parent.dart`, `ParentShell`, `ParentRepository`. Everything in `lib/core/` is reused unchanged. |
| Both platforms | **Android and iOS from the start** (the Principal/Teacher apps already ship to both; the toolchain, signing and push plumbing are proven). |
| Look | Web/app design tokens. Mirror the Teacher app's structural patterns (Home + More + detail screens, `state_views`, `responsive`, repository-per-feature). |
| Backend | Shared multi-tenant Express/Prisma backend on the VPS (`https://app.letssmartshala.com`). Online-only for v1, explicit error + retry states. |
| Push | Reuse the existing `PushService` / `PushMessenger` (`lib/core/push/`). Parent push is a new application ID in the same Firebase project. |
| Payments | Reuse the existing fees + Razorpay stack (`backend/src/modules/fees`, the `/pay` web flow). |

---

## 2. Decisions — **settled 2026-10-23**

### D1. How does a parent sign in? ✅ **Mobile number + admission number**
- **Username = parent's mobile number.** **Password = the student's SR / admission number** (`Student.admissionNumber`).
- On login, the backend finds all **active students in that school** whose `parentPhone` / `fatherPhone` / `motherPhone` / `guardianPhone` / `alternatePhone` equals the entered mobile number, and authenticates if **any one** of those students' `admissionNumber` matches the entered password.
- A valid login issues a **PARENT-scoped token keyed to (schoolId, mobile number)** — not to a single student.
- **No OTP, no SMS/WhatsApp provider needed** — this unblocks login entirely (the delivery-channel problem is gone).
- **No pre-provisioned parent accounts and no new `ParentGuardian` table for v1** — children are derived by matching the mobile number at query time. (If phone-string matching proves messy later, a proper link table is a clean follow-up; not needed now.)

> **Security note (acknowledged, your call stands):** admission numbers are low-entropy and known within the school, so this is light authentication. Acceptable for v1; we add a rate-limit on the login endpoint (reuse the existing `loginLimiter` pattern) and can harden later.

### D2. Select-student screen ✅
After login the parent lands on a **"Select Student" screen** listing **every child whose guardian phone matches the login mobile number** (name, class, roll, photo). Picking one opens the dashboard for that child; a switcher in **More / Profile** returns here. Multi-child is **in** for v1.

### D3. In-app payments ✅ **External Razorpay web flow** (recommended)
"Pay Now" opens the existing Razorpay web payment page in a browser tab — no native IAP, safest for Apple review.

### D4. Leave Requests + certificates ✅ **Deferred — read-only v1** (recommended)
Parent-initiated student leave is **not** in v1. Documents/Certificates are **read + download only**. Revisit in a later phase.

---

## 3. Screen inventory (from the reference, mapped to data we have)

| Screen | Backend status today | Notes |
|---|---|---|
| **Home / dashboard** | New endpoint needed | Aggregates: today's attendance, pending fees, next events, latest announcements, unread messages — all data we already store. |
| **Fees & Payments** | Data exists (`fees.service.ts`), **parent scoping new** | Breakdown + history + "Pay Now" → external Razorpay web flow (D3). |
| **Attendance** | Data exists (`attendance.service.ts`) | Monthly %, present/absent calendar — read-only. |
| **Calendar & Events** | Data exists (`calendar` module, `calendar_models`) | Reuse `core/data/calendar_models.dart`. |
| **Messages & Announcements** | Partially exists | Announcements with `PARENTS` audience already modelled (`announcements.schemas.ts`). Direct teacher↔parent messaging is **new** if wanted (decide later). |
| **Academic Performance** | Data exists (`marks.service.ts`, report cards) | Exams, progress, subject-wise; report-card PDF already generated. |
| **Homework & Assignments** | Data exists (`homework` module) | Read-only list, pending/completed. |
| **Leave Requests** | **New** (see D4) | **Deferred — not in v1** (read-only app for v1). |
| **Documents & Certificates** | Data exists (`StudentDocument`) | Report card, fee receipts (PDF exists), circulars — read + download. |
| **More / Profile** | New endpoint | Parent profile + child switcher + links to the above. |

---

## 4. Phased build

Each phase lists **backend → app**, and a **verify** check so we can loop to done per `CLAUDE.md §4`.

### Phase 0 — Foundations (no features) ✅ **done 2026-10-23**
1. **App flavor scaffolding.** ✅ `AppFlavor.parent` added to `app_config.dart` (appName/portalLabel/allowedRoles now switch over the flavor); `lib/main_parent.dart`; `ParentShell` with the five tabs (Home · Fees · Calendar · Messages · More) as placeholders; empty `ParentRepository`; Gradle `parent` flavor (`com.smartshala.parent`); iOS `parent` scheme + 4 xcconfigs + 9 build configs (Debug/Profile/Release across project + Runner + RunnerTests) + Podfile mapping; `push_config.dart` extended with empty parent App IDs (push stays disabled until Phase 6); `_wrongPortalMessage` and the login subtitle made flavor-aware.
   → **verify:** `flutter build apk --debug --flavor parent -t lib/main_parent.dart` builds ✅; `flutter analyze` clean ✅; test suite green except one pre-existing time-of-day-dependent `timetable_test` (unrelated) ✅; `pod install` integrates all three flavors identically ✅.
2. **Brand assets — placeholders only.** The Android `src/parent/res` and the iOS `AppIcon-parent.appiconset` are **copies of the teacher icons** so the build is green. **Real parent icon + splash are still to be made** (reuse `tool/generate_brand_assets.dart`) before any store build.
   → **verify (pending):** real parent icon + splash render; no teacher branding leaks in.

### Phase 1 — Parent identity & auth (mostly backend) ✅ **built 2026-10-23** (live test pending)
*No migration and no OTP provider — children are derived by phone match (per D1).*
1. **Login endpoint.** ✅ `POST /auth/parent/login` with `{ mobile, admissionNumber }` (`auth.service.ts` → `parentLogin`). Admission number is unique per school, so it is one indexed lookup per tenant — no phone scanning: the number locates the student, then the mobile must match one of that student's guardian phones (`parentPhone`/`father`/`mother`/`guardian`/`alternate`, matched on the last 10 digits via `utils/parentPhone.ts`). The matching tenant becomes the school. Rate-limited by IP+mobile.
2. **No User row, no migration, no refresh table.** ✅ The PARENT access token's subject is `parent:<mobile>`; the refresh token is **stateless** (marked `pt`), re-validated on `/auth/refresh` by confirming at least one of the parent's children is still enrolled (`refreshParent`). `/auth/me` is parent-aware the same way, so cold-start session restore works.
3. **School selection** is implicit: like staff login, the server scans active tenants and returns the school code as `tenantSchoolId`; the app scopes every later call to it. (Multi-school parents log into whichever school the entered admission number belongs to — a noted v1 limitation.)
4. **`GET /parent/children`** ✅ (`modules/parent/`) — PARENT-only, tenant-scoped; returns each child's id, name, class, roll, admission number, photo. The dormant PARENT branch of `students.service` `studentAccessFilter` was completed to the same 5-field match, so later phases stay consistent.
5. **App:** ✅ `ParentLoginScreen` (mobile + SR number) → `ParentSession` loads children → **Select Student** screen (auto-skipped for a single child) → per-child dashboard with a Change-child header; `loginBuilder` hook on `SmartShalaApp` keeps `core/` flavor-agnostic.
   → **verified:** `parentPhone` unit test (matching rules), `parent_select_child_test` widget test (load → pick / auto-select), `flutter analyze` clean, parent APK builds, backend `tsc` clean.
   → **pending (staging):** a real round-trip — parent logs in and sees exactly their own children; wrong admission number rejected; staff token rejected from `/parent/*` and vice-versa; a parent in school A cannot read school B; session survives a cold start. Needs the multi-tenant DB, so it runs on staging after this pushes (main auto-deploys staging).

### Phase 2 — Home + Attendance (first real value) ✅ **built 2026-10-23** (live test pending)
1. **Backend:** ✅ `GET /parent/children/:id/home` (child + this-month attendance + today's status) and `GET /parent/children/:id/attendance?month=YYYY-MM` (percentage, present/absent/leave/total, per-day marks). Both guard ownership via `parentStudentWhere`, and reuse `attendance.service` `getStudentMonthlyAttendance` so the numbers match the web for the same student.
2. **App:** ✅ Home tab (`ParentHomeScreen`: today's-attendance card + tappable month summary with a percentage ring) → Attendance screen (`ParentAttendanceScreen`: ring, present/absent/total KPI tiles, a Mon-first month calendar coloured by status with a legend and month stepping). Switching child re-fetches (`didUpdateWidget`). Reuses `HomeSurface`, `KpiBlock` and the design tokens.
   → **verified:** `parent_attendance_test` + updated `parent_select_child_test` widget tests, `flutter analyze` clean, parent APK builds, backend `tsc` clean.
   → **pending (staging):** app numbers match the web dashboard for the same student; a parent cannot read another child's attendance (ownership 404).

### Phase 3 — Academics (Performance + Homework) ✅ **built 2026-10-23**
1. **Backend:** ✅ `GET /parent/children/:id/academics` (exam results grouped by exam, per-subject marks + grade via the shared `gradeForPercentage` bands, overall %) and `GET /parent/children/:id/homework` (every assignment for the child's class with their submission state). Both ownership-guarded.
2. **App:** ✅ Academics screen (overall-performance ring + per-exam cards with a Subject/Marks/Grade table) and Homework screen (Pending/Completed toggle with counts, overdue highlighting). Reached from two **Quick links** tiles added to the Home tab.
   → **verified:** `parent_academics_homework_test` widget tests, analyze clean, parent APK builds, backend `tsc` clean. Live check pending alongside the others.

### Phase 4 — Fees & Payments — *external Razorpay web flow per D3* ✅ **built 2026-10-24** (live test pending)
> **Correction to the original assumption:** there was **no existing online student-fee flow** to reuse — `/pay/[token]` is the **SaaS billing** flow (schools paying their own subscription), in the master DB. Student fees are staff-recorded in the tenant DB, and `Payment.recordedById` is a required FK to a staff `User` that parents don't have. So Phase 4 built a **new, migration-free** online student-fee flow modelled on the billing one.
1. **Backend:** ✅
   - `GET /parent/children/:id/fees` — summary, each assignment's balance, payment history (reuses `getStudentLedger`, so the numbers match the web).
   - `POST /parent/children/:id/fees/pay-link` — mints a **stateless signed token** (JWT, 30 min, `typ: "fee_pay"`, carries school uuid + tenant code + student + assignment + amount) and returns `${FRONTEND_URL}/student-pay/<token>`. **No new table, no migration.**
   - `GET /parent/children/:id/fees/receipts/:paymentId/pdf` — ownership-guarded receipt download (reuses `getReceiptPdf`).
   - Public, tenant-agnostic router **`/student-pay`** (`modules/parent/feePay.*`): `view`, `checkout` (creates the Razorpay order with `notes.kind = STUDENT_FEE` carrying the tenant/student/assignment for the webhook), `confirm` (verifies the checkout signature, settles), `mock-gateway/pay`. The token in the URL is the whole credential and routes to the right tenant DB.
   - **Settlement** records a tenant `Payment` via the existing `collectPayment` as `ONLINE_GATEWAY`, attributed to a per-school **auto-provisioned, inactive "Online Payment (Parent App)" `User`** (no schema change; hidden from staff lists because they filter `isActive`). Idempotent across the confirm callback + the Razorpay webhook via the unique `gatewayTransactionId` (and the amount is re-capped to the current balance at settle time).
   - The **billing Razorpay webhook** (`/webhooks/razorpay`) now branches: an order unknown to the master billing tables whose `notes.kind === STUDENT_FEE` is settled in the tenant DB instead. Same webhook URL, so **no new Razorpay dashboard config**.
2. **App:** ✅ Fees tab (`ParentFeesScreen`): outstanding-balance summary, per-assignment breakdown with a **Pay** button that opens the external Razorpay page via `url_launcher` (Apple-safe, D3), and payment history with receipt download via the share sheet. Wired as tab index 1 in `ParentShell`.
   → **verified:** `parent_fees_test` widget test, `flutter analyze` clean, parent APK builds, backend + frontend `tsc` clean.
   → **pending (staging/prod):** an end-to-end mock-mode payment reconciles and the receipt downloads; confirm + webhook don't double-record; `RAZORPAY_MODE=live` on prod uses the real keys and the shared webhook (see memory [[razorpay-mode-live-in-env]]); a parent cannot pay or read another child's fees (ownership 404).

### Phase 5 — Calendar, Announcements & Documents ✅ **built 2026-10-24** (live test pending)
1. **Backend:** ✅
   - `GET /parent/calendar?month=YYYY-MM` — reuses the staff `calendar.service` `listMonth`, scoped to the parent's school (events + holidays; the same for every child). Defaults to the current month.
   - `GET /parent/announcements` — the school's `ALL`/`PARENTS`-audience notices, newest first, paged (`limit`/`offset`). **No read tracking** (parents have no `User` row), so every item is returned `isRead: true` — the feed is purely read-only.
   - `GET /parent/children/:id/documents` — ownership-guarded list of the child's `StudentDocument`s (report cards, certificates, …).
   - `GET /parent/children/:id/documents/:documentId/download` — ownership-guarded; mirrors the staff download (S3 → presigned URL as JSON which the app opens in a browser tab; local disk → served directly, dev only).
2. **App:** ✅
   - Calendar tab (`ParentCalendarScreen`): month stepper + event cards typed/coloured via the shared `core/data/calendar_models.dart`.
   - Messages tab (`ParentAnnouncementsScreen`): reuses the shared `AnnouncementCard` + `AnnouncementDetailScreen`.
   - More tab (`ParentMoreScreen`): child identity, a link to **Documents & Certificates** (`ParentDocumentsScreen`, opens each via `url_launcher` — Apple-safe), a child switcher when there is more than one, and Sign out. This replaces the last placeholder tabs, so the five-tab shell is now fully built.
   → **verified:** `parent_phase5_test` widget tests (calendar/announcements/documents), `flutter analyze` clean, parent APK builds, backend `tsc` clean.
   → **pending (staging):** a `PARENTS` announcement posted on the web appears in the feed; a report-card PDF opens/downloads; a parent cannot read another child's documents (ownership 404).

### Phase 6 — Push notifications
1. New application ID registered in the existing Firebase project (`smartshala-a9822`, see memory); parent token registration reusing `PushService`.
2. Parent-relevant triggers (fee due, attendance absent, new announcement, new homework) — decide the set.
   → **verify:** a real device receives a push and deep-links to the right screen.

### Phase 7 — (Deferred candidates) Leave Requests, direct messaging
Only if D4 / messaging are later approved. Read-only v1 ships without them.

### Phase 8 — Store release
1. Reuse the Play + App Store release runbooks (see `PLAY_STORE_RELEASE.md`, `APP_STORE_RELEASE.md` and memory). New listings, screenshots, privacy policy entry for a parent app, demo parent account for review.
   → **verify:** internal track on Play + TestFlight build install cleanly; demo login works for reviewers.

---

## 5. What we reuse vs build new

**Reuse unchanged:** `core/api/api_client.dart`, `core/auth/*` (token storage, controller pattern), `core/push/*`, `core/theme/*`, `core/widgets/*` (`BrandHeader`, `CustomSelect`, `state_views`, `responsive`), `core/data/calendar_models.dart`, `student_models.dart`, the `SmartShalaApp` shell, the `AppFlavor` pattern, the Razorpay fee flow, the PDF generators (report card, receipt), the brand-asset and release pipelines.

**Build new:** parent auth (mobile + admission-number login → PARENT token), `/parent/children` and `/parent/*` read endpoints, `ParentShell` + `ParentRepository` + the Select-Student screen and the parent screens, parent push application ID, parent store listings. *(No migration and no OTP provider in v1.)*

---

## 6. Risks / watch-items
- **Light auth.** Mobile + admission number is low-entropy (D1); the login endpoint must be rate-limited, and we accept this for v1.
- **No migration in v1** — children are matched on phone strings, so there is no P3009 migration risk here. If we later add a `ParentGuardian` link table, it gets the full prod pre-flight (see memory).
- **Apple review on payments** — "Pay Now" stays an external Razorpay web flow (D3) to avoid IAP rejection.
- **Multi-tenant scoping** must be enforced on every new parent endpoint; a parent token must never cross schools or read an unlinked student.
- **Phone-match edge cases** — a mobile number shared across unrelated families, or a number that matches students in two schools, must be handled (school is part of login, which disambiguates).
- Keep **Payroll/Transport** flags irrelevant here — not a parent concern.

---

**Next action:** all decisions are settled. Start **Phase 0** (flavor + shell scaffolding), then **Phase 1** (parent login + Select Student).
