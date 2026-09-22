# SmartShala V2.0 — Mobile Apps Implementation Plan

**Source of truth:** [SmartShala_App_V2_0_Product_UI_Blueprint.pdf](SmartShala_App_V2_0_Product_UI_Blueprint.pdf) (in this folder)
**Created:** 2026-09-05
**Status:** Phases 0–6 complete, and **Phase 7 is done**: bell timings with Now/Upcoming badges (item 29),
Transport (item 30), Payroll with teacher Salary Details (item 31) and Timetable in both apps (2026-09-19).
Phase 8 items 33 and 34 are done too. What is left — push notifications (32) and Play Store prep (35), and with them
the principal app's last placeholder, Notifications — is **blocked on a Firebase project and a signing keystore**,
not on code. See Phase 8 for what is needed.

## Decisions taken (2026-09-05)

| Question | Decision |
|---|---|
| Stack | **Flutter** (Android first). Flutter 3.44 / Dart 3.12. |
| App split | **One codebase, two binaries** — `lib/main_principal.dart` + `lib/main_teacher.dart`, Gradle flavors `principal` / `teacher`, separate application IDs. Everything in `lib/core/` is shared. |
| iOS | Not now; Flutter keeps the door open. |
| Reports vs Fee Reports | §1/§3 win — **no Finance in Reports**. Fees stay under More → Finance, principal only. |
| Offline | **Online-only for v1**, with explicit error and retry states. |
| Punch rules | One punch-in + one punch-out per day. No geofencing, no location capture in v1. |
| Payroll | Recorded slips only, no salary computation (Phase 7). |
| Web dashboard | Stays the primary admin surface; the apps are companions. |
| Announcements | School-wide for v1 (Phase 4). |
| Period times (2026-09-11) | **One school-wide bell** — the same start/end per period for every class and weekday — set on the **web dashboard** Settings page. |
| Android first (2026-09-13) | **Android only** until the Android apps are delivered in full. iOS work starts after that. |
| Payroll entry (2026-09-13) | The principal records monthly slips on the **web dashboard** Payroll page. Teachers read their own in the app Salary tab and on the web My Salary page. |
| Teacher dashboard (2026-09-13) | **Web and app are one dashboard:** same endpoints, KPIs, labels and order. The app Home gains class attendance, Today's Actions and alerts; the web gains today's punch and schedule. |
| App look (2026-09-13) | **The apps use the web's design tokens** — colours, 6/8px radii, pastel KPI cards, Inter — and one responsive layer. |

---

## 0. What changes with V2.0

Until now SmartShala is a **web dashboard for the principal** (Next.js frontend + Express/Prisma multi-tenant backend).
V2.0 adds **two Android apps**:

| App | Audience | Character |
|---|---|---|
| Principal App | Principal / Admin | Command-center: Home + More + detail pages |
| Teacher App | Teacher | Daily teaching work only — much simpler |

The existing web dashboard is **not replaced**. The backend is shared; both apps talk to the same API.

### Core UX principle (from the blueprint)
- Important actions stay visible; secondary actions live under **More**.
- Creation actions go behind the **+** button.
- Attendance punching is a **horizontal swipe gesture** ("Swipe To Punch") — never a circular tap button.
- Clean mobile-first UI, larger readable icons, whitespace, blue SmartShala branding, minimal cards.

---

## 1. Decisions already locked in the blueprint

| Area | Decision |
|---|---|
| Principal home | Key school overview + a limited set of quick actions. Not every module. |
| More | Secondary school-management sections live here, not on Home. |
| + button | Add Student, Add Teacher, Add Class/Section, Create Announcement, Create Event/Notice. |
| Teacher portal | Attendance, homework, marks, student records, leave, calendar, salary, students needing focus. |
| Teacher fees | **Never shown to teachers.** |
| Messages | Teacher leave/status + school announcements. |
| Attendance punch | Horizontal "Swipe To Punch" bar fixed above bottom navigation. |
| Reports | Academic/operational insights only — **Finance section removed** from Reports. |

### What NOT to overload (explicit anti-goals)
- Do not put every module on Home.
- Do not repeat the same action in multiple places unless it is high-frequency.
- Do not include Finance inside Reports.
- Do not add decorative/demographic clutter to management lists.
- Keep detailed records inside their dedicated profile/detail pages.

---

## 2. Screen inventory

### 2.1 Principal App

**Bottom nav:** Home · Reports · **+** · Messages · More

| Screen | Contents (per blueprint) |
|---|---|
| Home / Dashboard | Today's overview, alerts/notifications, limited quick actions, today's attendance + key metrics |
| More | Search + 4 groups: School Management (School Profile, Teacher Management, Classes & Sections, Subjects, Timetable, Transport), Academics (Exams, Reports, Academic Calendar), Finance (Fee Management, Fee Reports), Communication (Announcements, Messages, Notifications) |
| Student Management | Stat tiles (total/active/inactive/promoted), search, filter, paginated list (student, class & section, status, action), Quick Actions: Add Student, Import Students, Student Promotion, Export List |
| Student Profile | Header (photo, ID, class, roll no), quick facts (age, gender, blood group, DOB), tabs: Overview / Academics / Attendance / Fees / Documents / More; Basic Info, Class Info, Attendance Summary, Parent/Guardian; Quick Actions: Call Parent, Send Message, View Report Card, View Attendance |
| Fees Management | Stat tiles (total/collected/pending/overdue), Quick Actions (Fee Collection, Send Reminder, Fee Reports, Fee Settings), tabs Fee Overview / Class Wise Collection, recent payments, pending fee overview by class, auto-reminder toggle |
| School Profile | Logo + code + status, Basic Information, Contact, Address (+map), Quick Stats, Important Documents, Edit School Profile |
| Teacher Management | Stat tiles (total/active/inactive/female/male), search, filter, Add Teacher, paginated list (teacher, subjects, department, status, action), Quick Actions: Add Teacher, Import Teachers, Teacher Attendance, Teacher Leave, Export List |
| Teacher Profile | Header (photo, EMP ID, subject, department, status), Basic Information, Teaching Details (assigned subjects, classes & sections, class teacher of), Attendance Summary (present/absent/leave/%), Quick Actions: Call, Message, View Attendance, Edit Profile |
| Academic Calendar | Month grid with event dots, legend filter (Exams/Holidays/Events/Meetings), Upcoming Events list, Add New Event |
| Reports | Search + filter, Quick Access tiles (Student, Attendance, Fee, Teacher, Exam, Transport reports), Detailed Reports list (Class Wise Performance, Subject Wise Performance, Daily Attendance, Custom Reports, Report History), Create Report |
| Leave Approval | Stat tiles (total/pending/approved/rejected), search, tabs Pending/Approved/Rejected, request cards with Approve / Reject, Load More |
| Also in checklist | Classes & Sections, Timetable, Transport, Exams, Payroll |

> Note: the Reports screen mock still shows a "Fee Reports" tile under Quick Access while §1 and §3 say to remove Finance from Reports. **Resolve before building Reports** — see Open Questions.

### 2.2 Teacher App

**Bottom nav:** Home · Calendar · (Students) · Salary · Notifications — with the **Swipe To Punch** bar fixed directly above it on every screen.

| Screen | Contents |
|---|---|
| Home | Greeting header, date selector, Today's Overview (classes today, students, homework due, tasks pending), Quick Actions grid (Mark Attendance, Homework, Marks, My Students, Apply Leave, Students Needing Focus, Calendar, More), Today's Schedule with Now/Upcoming badges |
| Mark Attendance | Class picker, date, counters (total/present/absent), tabs Student List / Absent, search, per-student Present/Absent toggle, Save |
| Homework | Tabs Assigned / Submissions, homework cards (title, class-subject, due date, submitted count), Create Homework |
| Marks | Class picker, exam picker, Top Performers, class average, per-student score entry, distribution chart |
| My Students | Class picker, search, student list with performance %, tap to open profile (**no fee information**) |
| Students Needing Focus | Students flagged by attendance/performance indicators |
| Apply Leave | Leave type, from date, to date, reason (0/500), optional attachment, Submit |
| Messages | Tabs All / Announcements / Leave / Others; leave cards show type, dates, reason, applied-on, status (Pending/Approved/Rejected); Apply Leave FAB |
| Calendar | Month grid + events list (PTM, exhibitions, tests) |
| Salary Details | Personal salary/pay info, salary slips |

---

## 3. Current backend state (what we already have)

Backend: Express + Prisma, **multi-tenant** — routes are mounted at `/:schoolId/api` and `/:schoolId/api/v1`
(see [app.ts](../../backend/src/app.ts), [tenant.middleware.ts](../../backend/src/middleware/tenant.middleware.ts)).
Auth is JWT bearer + refresh, roles `PRINCIPAL | ADMIN | TEACHER | ACCOUNTANT | PARENT`
(see [auth.ts](../../backend/src/middleware/auth.ts)).

**Existing API modules:** academicYears, activity, analytics, attendance, auth, chatbot, classes, communication, dashboard, demo, fees, homework, marks, notifications, onboarding, reports, settings, students, superAdmin, tenantSetup, users, whatsapp.

**Existing Prisma models:** School, AcademicYear, User, RefreshToken, Class, Student, AuditLog, CommunicationLog, BehaviourRecord, StudentDocument, Subject, TeacherPeriodAssignment, Exam, ExamResult, HomeworkRecord, HomeworkAssignment, HomeworkSubmission, AttendanceSession, AttendanceRecord, FeeStructure, FeeInstallment, StudentFeeAssignment, Payment, FeeAdjustment, Receipt, Notification, Holiday.

---

## 4. Gap analysis — what V2.0 needs that does not exist yet

| V2.0 feature | Backend status | Work needed |
|---|---|---|
| Student Mgmt + Profile | OK — students module | Mobile-shaped response (list + stat tiles in one call) |
| Teacher Mgmt + Profile | PARTIAL — users module | Teacher-specific list/detail endpoints, gender/department stats |
| Fees Management | OK — fees module | Aggregation endpoints for the stat tiles / class-wise collection |
| Homework | OK — homework module | Submission counts for teacher list view |
| Marks | OK — marks module | Top performers + class average endpoint |
| Student attendance | OK — attendance module | Reuse as-is for teacher Mark Attendance |
| Reports | OK — reports + analytics | Remove Finance from the mobile Reports screen |
| Academic Calendar | PARTIAL — only `Holiday` | **New:** `CalendarEvent` model (type: EXAM/HOLIDAY/EVENT/MEETING) + CRUD |
| Timetable | PARTIAL — `TeacherPeriodAssignment` | Period/time-slot definitions + "today's schedule" endpoint |
| **Teacher punch (Swipe To Punch)** | MISSING | **New:** `StaffAttendance` model + punch-in/punch-out endpoints + today status |
| **Leave (apply + approve)** | MISSING | **New:** `LeaveRequest` model, teacher submit, principal approve/reject, attachment upload |
| **Payroll / Salary Details** | MISSING | **New:** `SalaryStructure` + `SalarySlip` models, principal payroll + teacher read-only view |
| **Transport** | MISSING | **New:** routes, vehicles, drivers, student-route assignment |
| Exams | OK — `Exam` model | Exam management screens |
| Announcements | PARTIAL — communication module | First-class announcement entity + read state for the Messages tab |
| **Push notifications** | MISSING | **New:** `DeviceToken` model + FCM integration |
| Students Needing Focus | PARTIAL — analytics | Derived endpoint (attendance % + marks thresholds) |

---

## 5. Cross-cutting mobile concerns to settle first

1. **School code at login.** The API is tenant-scoped by URL (`/:schoolId/api/...`). The web dashboard knows its
   tenant; a mobile app does not. Login flow needs a school-code step (or a lookup-by-identifier endpoint) before
   the app knows which tenant base URL to call.
2. **Token storage & refresh.** Web uses cookies + bearer. Mobile needs encrypted secure storage plus a refresh
   interceptor; sessions should be long-lived so teachers are not re-logging in daily.
3. **Role gating.** Teacher app must be hard-blocked from all fee endpoints — enforced **server-side** with
   `requireRole`, not just hidden in UI.
4. **Offline behaviour.** Attendance marking and punch happen in corridors with poor signal. Decide: online-only
   with clear errors, or queue-and-sync.
5. **API base URL.** Native apps do not send an `Origin`, so CORS is a non-issue, but the app needs a
   configurable base URL for dev/staging/prod.
6. **File uploads.** Leave attachments, teacher/student photos, school logo — reuse the existing upload path.

---

## 6. Phased implementation plan

Each phase states a verification check. Nothing moves forward until its check passes.

### Phase 0 — Foundations ✅ done
1. ✅ Flutter project at [mobile/](../../mobile/), two entrypoints + Gradle flavors →
   **verified:** `flutter build apk --debug --flavor teacher|principal` both produce APKs.
2. ✅ Shared API client ([api_client.dart](../../mobile/lib/core/api/api_client.dart)): tenant-scoped
   `/{schoolCode}/api/v1` URLs, keystore token storage, single-flight refresh-on-401, error mapping →
   **verified:** login, punch and refresh exercised over HTTP against a local backend.
3. ✅ Design system: [app_colors.dart](../../mobile/lib/core/theme/app_colors.dart),
   [app_theme.dart](../../mobile/lib/core/theme/app_theme.dart),
   [app_cards.dart](../../mobile/lib/core/widgets/app_cards.dart) — cards, stat tiles, quick actions,
   list rows, brand header, loading/error/empty views.

### Phase 1 — Auth + shells ✅ done
4. ✅ Login with school code + identifier + password, sign-out, session restore via `/auth/me` →
   **verified:** each binary rejects the other's role with a message naming the right app.
5. ✅ Principal shell: Home · Reports · **+** · Messages · More, Quick Add sheet, More screen with
   search and the four blueprint groups →
   **verified:** all 15 More tiles and all 5 Quick Add actions route to a labelled placeholder.
6. ✅ Teacher shell: 5-tab nav with the Swipe To Punch bar pinned above it on every screen →
   **verified:** 5 widget tests in
   [swipe_to_punch_test.dart](../../mobile/test/swipe_to_punch_test.dart) — a tap never punches,
   a short drag springs back, a full drag punches exactly once.

#### Sessions survive closing the app (fixed 2026-09-11)
Reopening the app signed the teacher out whenever the first check of the stored session did not get a clean
answer. Two faults combined:
- `restoreSession` cleared the stored tokens on **any** error from `/auth/me` — including a timeout while the
  hosted backend woke from sleep, or simply no signal.
- The refresh interceptor reported a refresh that never reached the server as the original 401, so even a network
  failure looked like "session rejected".

Now only a 401 ends a session. A refresh that fails without a 401/403 from the server surfaces as the network,
timeout or 5xx error it was, and `restoreSession` keeps the session and shows "You are still signed in" with
**Try again**. This lives in `core/`, so it applies to both apps. The backend was already correct — refresh tokens
last 7 days and are not rotated. **Verified over HTTP** with 15-second access tokens: expired token 401, refresh
with the stored token 200, the same refresh token again 200, a bogus token 401. Pinned by
[auth_restore_test.dart](../../mobile/test/auth_restore_test.dart) and
[api_client_refresh_test.dart](../../mobile/test/api_client_refresh_test.dart).

Still true by design: signing out anywhere, including the web dashboard, revokes every refresh token that user
holds, so it signs the phone out too.

### Phase 2 — Teacher daily loop ✅ done
7. ✅ **Backend:** `StaffAttendance` model + migration + `/staff-attendance/me/{today,punch-in,punch-out,history}` →
   **verified:** [staffAttendance.test.ts](../../backend/tests/staffAttendance.test.ts) against a real
   database, and over HTTP: punch-in 201, second punch-in 409, punch-out 200, second punch-out 409,
   punch-out before punch-in 409.
8. ✅ Swipe To Punch wired to the API through
   [punch_controller.dart](../../mobile/lib/features/teacher/data/punch_controller.dart); state is
   read from the server on launch, so it survives restart. A 409 re-reads rather than guessing.
9. ✅ [Mark Attendance screen](../../mobile/lib/features/teacher/attendance/mark_attendance_screen.dart)
   on the existing `/attendance/roster` + `/attendance/mark` endpoints — class picker, date picker,
   live counters, Student List / Absent tabs, search, holiday lock.
10. ✅ Today's Overview from `GET /dashboard`; Today's Schedule from the new `GET /users/me/schedule`.

> **Not yet verified on a device.** Everything above is verified by build, widget tests, DB-level
> integration tests and live HTTP calls. Nobody has run either APK on an emulator or handset yet, so
> item 9's "appears in the principal web dashboard" and item 8's restart check still need a manual
> pass. **Deferred from item 10:** the "Now / Upcoming" badge needs per-period start and end times,
> which the schema does not have — `TeacherPeriodAssignment` stores only a period *number*. The
> schedule therefore lists periods as "P1, P2, …". Real clock times arrive with Timetable in Phase 7.

### Phase 3 — Teacher academics ✅ done
11. ✅ [Homework](../../mobile/lib/features/teacher/homework/) — list with submitted/total progress,
    Create Homework (class, subject, title, due date, description), and a Submissions screen that sets
    each student's status →
    **verified over HTTP:** creating an assignment returned 201, appeared in that class's list, and
    auto-created a submission row for all 3 students.
12. ✅ [Marks](../../mobile/lib/features/teacher/marks/marks_screen.dart) — class + exam pickers, class
    average, max marks, pending count, top three performers, per-student entry →
    **verified over HTTP:** marks 45 and 25 of 50 gave a class average of 70 with 2 entered / 1 pending;
    90/60/30 of 100 gave 60 with grades A+/B/F.
13. ✅ [My Students](../../mobile/lib/features/teacher/students/my_students_screen.dart) +
    [Student Profile](../../mobile/lib/features/teacher/students/student_profile_screen.dart), fees stripped →
    **verified:** see "Fee isolation" below.
14. ✅ [Students Needing Focus](../../mobile/lib/features/teacher/students/students_needing_focus_screen.dart)
    on a new fees-free endpoint; the screen prints the rules it used →
    **verified:** 40% attendance flags HIGH, 100% attendance does not flag, 3 missing homework items flag
    MEDIUM, and the thresholds are returned to the client rather than hardcoded in the app.

#### Marks are write-once for teachers
`PATCH /marks/exams/:id/results` returns **403** when a result already exists and the caller is a
teacher — "Marks have already been submitted and can only be modified by a Principal or Admin." This is
a deliberate integrity rule in the existing backend, not a bug. The Marks screen now reflects it: rows
without a result are tappable, submitted rows show a lock, and a note explains that only the principal
can amend them. **Confirmed live:** entering marks for an unscored student returned 200; amending the
same student returned 403.

#### Fee isolation (item 13) — verified, and one leak fixed
The backend already gated fee data by role (`teacherTabs` has no `"fees"` entry), but auditing the real
payloads turned up `transportFeeAmount` — a fee figure stored on the student row itself, which therefore
rode along with the base column spread instead of the fee relations. It is now grouped with the other
fee fields in both `listStudents` and `getStudent`.

After the fix, for a teacher token:
- `GET /students` — no fee-related key at all
- `GET /students/:id` — `feeAssignments: []`, `feeBalance: 0`, and `access.allowedTabs` excludes `fees`.
  The keys stay present so the web dashboard's response shape is unchanged, but carry no values.
- The same calls as a principal still return the assignment, a balance of 10000 and the transport fee,
  so the assertions prove something rather than passing vacuously.

Pinned by [teacherStudentAccess.test.ts](../../backend/tests/teacherStudentAccess.test.ts).

> **Still not device-tested.** As with Phases 0–2, everything here is verified by build, analyzer,
> DB-level integration tests and live HTTP calls. No APK has been run on an emulator or handset yet.

### Phase 4 — Leave & Messages (both apps) ✅ done
15. ✅ **Backend:** `LeaveRequest` model +
    [migration](../../backend/prisma/migrations/20260907000000_add_leave_and_announcements/migration.sql) +
    [leave module](../../backend/src/modules/leave/) — apply (with an optional PDF/image attachment, 5 MB
    cap), own list, school-wide list, approve/reject, withdraw, attachment download →
    **verified over HTTP:** a teacher applying got 201; that teacher approving got 403; a **principal
    approving their own request got 403 `CANNOT_DECIDE_OWN_LEAVE`**; the principal approving the teacher got
    200; a second decision got 409.
16. ✅ [Apply Leave](../../mobile/lib/features/teacher/leave/apply_leave_screen.dart) (type, date range with a
    live day count, 500-character reason, optional attachment) and
    [Messages](../../mobile/lib/features/teacher/messages/teacher_messages_screen.dart) with the blueprint's
    All / Announcements / Leave tabs →
    **verified over HTTP:** the teacher's own list returned the request as `APPROVED` on the next read, and
    returned nothing at all for a second teacher.
17. ✅ [Leave Approval](../../mobile/lib/features/principal/leave/leave_approval_screen.dart) — stat tiles,
    Pending / Approved / Rejected tabs, search by name, Approve / Reject with an optional note, Load More →
    **verified:** every list response carries the whole-school tile counts, so after the approval above the
    tiles read total 2 / approved 1 / pending 1 and cannot drift from the list they sit over.
18. ✅ Announcements in both apps —
    [create](../../mobile/lib/features/principal/announcements/create_announcement_screen.dart) with audience
    and priority, read with per-user read state →
    **verified over HTTP:** a `STAFF` announcement posted by the principal appeared in the teacher's feed with
    an unread badge of 1, a `PARENTS` one did not appear at all, a teacher posting got 403, and marking read
    twice left one row and a badge of 0.

#### Nobody approves their own leave
A principal applies for leave through the same endpoint as everyone else, so role alone cannot enforce this:
`PATCH /leave/requests/:id/decision` compares the applicant to the caller and returns **403
`CANNOT_DECIDE_OWN_LEAVE`** when they match. Pinned by
[leaveAndAnnouncements.test.ts](../../backend/tests/leaveAndAnnouncements.test.ts) and confirmed live.

#### Leave attachments end to end
Apply Leave has an optional attach/remove row backed by `file_picker`, uploading through a new multipart path
in [api_client.dart](../../mobile/lib/core/api/api_client.dart). No Android permission is needed — the picker
uses the system document chooser. Two details worth keeping:

- The 401 refresh-and-retry clones the `FormData` before replaying it. A form body is a one-shot stream, so
  the original retry would have re-sent an empty body after a token refresh.
- `file_picker` is **held on 8.x**. From 9.x its Android module stops applying the Kotlin Gradle Plugin on
  AGP 9 and expects `android.builtInKotlin`, which this project has off; turning that on instead breaks its
  transitive `flutter_plugin_android_lifecycle`, which still applies KGP. 8.x is plain Java on Android and
  needs neither, so no Gradle configuration changed. Re-test both APKs before raising that constraint.

**Verified over HTTP:** a multipart apply returned 201 with the original filename preserved and the text
fields still parsed; the stored PDF came back byte-identical; an `.exe` was rejected 400
`UNSUPPORTED_ATTACHMENT_TYPE`; the applicant and the principal could both download it and a second teacher
got 403; and the plain-JSON path (no file) still returned 201 with `hasAttachment: false`.

> **Still not device-tested,** as with Phases 0–3. Everything above is verified by build, analyzer, widget
> tests, DB-level integration tests and live HTTP calls against a local backend. No APK has been run on an
> emulator or handset yet.

### Phase 5 — Principal management screens
19. ✅ Home / Dashboard — [principal_home_screen.dart](../../mobile/lib/features/principal/principal_home_screen.dart)
    mirrors the web admin dashboard: pulse line, the five KPI cards (Students, Marked Today, Defaulters, Collected,
    Alerts), attendance in marked classes, Fee Overview, the alert list and today's activity. App-only additions are the
    school card and three working quick actions: Leave Approval (with a pending badge), Announcement and Messages. The
    web's Record Payment / Send Fee Reminder / Add Student need Phase 5 screens that don't exist yet, so they are not on
    the app. →
    **verified:** metrics match the web for the same school and day. The real `GET /dashboard` and `GET /activity-logs`
    responses from a local backend (27 students, 21 defaulters, 8 alerts) were fed to the web's own logic, copied
    verbatim from `DashboardHome.tsx` / `formatters.ts`, and to the app's models. The two outputs were **byte-identical**
    (pulse, all five KPIs, fee totals, every alert label, severity and detail, activity text). Pinned by
    [principal_dashboard_test.dart](../../mobile/test/principal_dashboard_test.dart), which also lays the screen out at 390dp,
    at 320dp with 1.3× text, and at 1200dp with all five KPIs on one row.

#### One source for dashboard logic in the apps
The web's `actionAlerts`, `formatINR`, `humanizeConstant`, `relativeTime` and activity wording are ported once, to
[dashboard_models.dart](../../mobile/lib/core/data/dashboard_models.dart). The class attendance, segment bar, alert list and
activity widgets live in [dashboard_widgets.dart](../../mobile/lib/core/widgets/dashboard_widgets.dart). Both Homes use them.
As a result the teacher Home now also lists low-attendance classes in its alerts, as the web does.
One deliberate difference: when an alert has no flags, the web prints the raw severity ("MEDIUM") as its detail line.
The app leaves that line empty because the severity badge already says it.

The notification bell in both apps used a hardcoded "3". It now shows the real unread announcement count and opens
Messages. Salary amounts on the web Payroll and My Salary pages and in the app now format the same way: whole rupees
unless there are paise, with the web's non-breaking space.
20. ✅ Student Management + Student Profile —
    [student_management_screen.dart](../../mobile/lib/features/principal/students/student_management_screen.dart),
    [student_profile_screen.dart](../../mobile/lib/features/principal/students/student_profile_screen.dart) and
    [add_student_screen.dart](../../mobile/lib/features/principal/students/add_student_screen.dart), opened from More,
    Quick Add, the Home Students KPI card and a Students quick action.
    - **List:** Total / Active / Inactive tiles, debounced search, class and fee-status filters, an Active / Inactive
      switch and Load More paging. Filters and paging are the same as the web Students page's.
    - **Quick actions:** **Add Student** (the web form's required fields; the admission number is generated when blank)
      and **Export List** (CSV through the Android share sheet).
    - **Profile:** header, quick facts (age, gender, DOB, joined), Call Parent / WhatsApp / Attendance, tabs Overview ·
      Academics · Attendance · Fees · Documents limited to the server's `access.allowedTabs`, and Deactivate /
      Reactivate.

    **Not built, on purpose:**
    - *Import Students* and *Student Promotion* stay on the web. Import is a CSV mapping flow; promotion is the
      academic-year rollover.
    - The blueprint's *Promoted* tile and *blood group* fact have no data in the schema.

    **Verified:**
    - [student_management_test.dart](../../mobile/test/student_management_test.dart) — 20 tests: fee-status rules,
      CSV, WhatsApp link, create payload, paging, search debounce, filters, server-driven tabs, deactivate confirm,
      form validation, and layouts at 320dp with 1.3× text and at 1200dp. They caught a filter chip overflow and a
      `setState` that returned a Future; both are fixed.
    - The web's own `toStudentRows` + CSV code, run on all 27 real students from a local backend, and the app's
      models gave a **byte-identical** CSV (6 overdue, 6 paid, 15 pending).
    - Over HTTP: create 201 with auto admission number `ADM-2026-001`; missing parent phone 400; search, class filter
      and pagination (10/28, 8/28, 0) correct; deactivate / reactivate moved the counts; teacher create and deactivate 403.

#### Fee-status filter: the app matches the web, including its gap
The server's fee filter reads stored assignment status. The Students list derives its badge from that status *plus*
money due now. So a "Pending" query returns students the list badges Overdue (on real data: 21 rows, 6 of them
badged Overdue). The web re-filters each page on its side and shows 15; the app now does the same, and counts paging
on server rows so Load More still ends.

**Open bug, web and app alike:** "Overdue Fees" returns nothing for students who are overdue only by due date
(0 results against 6 Overdue badges). The fix belongs in `getFeeStatusFilter` (backend) and would change the web too,
so it is left for a decision.

#### Two new Android plugins, one Gradle setting
`url_launcher` (Call / WhatsApp) and `share_plus` (Export) were added. `share_plus` failed to compile with "Could not
close incremental caches". That is a Kotlin incremental-compilation bug on Windows when the project (D:) and the pub
cache (C:) are on different drives. [gradle.properties](../../mobile/android/gradle.properties) now sets
`kotlin.incremental=false`. Both APKs build; the remaining "Built-in Kotlin" message is a deprecation warning. The
manifest declares the `tel` and `https` intents Android 11+ requires for those launches.
21. ✅ Teacher Management + Teacher Profile —
    [teacher_management_screen.dart](../../mobile/lib/features/principal/teachers/teacher_management_screen.dart),
    [teacher_profile_screen.dart](../../mobile/lib/features/principal/teachers/teacher_profile_screen.dart) and
    [add_teacher_screen.dart](../../mobile/lib/features/principal/teachers/add_teacher_screen.dart) (Add and Edit),
    opened from More and Quick Add.
    - **List:** Total / Active / Inactive tiles, search, Subject and Class Teacher filters, an Active / Inactive
      switch, 20 rows at a time. Like the web Teachers page, it loads the whole list and filters locally.
    - **Quick actions:** **Add Teacher** (the web form's fields), **Export List** (CSV) and **Teacher Leave**
      (opens Leave Approval).
    - **Profile:** header, Call / WhatsApp / Edit Profile, Basic Information, Teaching Details (subjects, classes,
      class teacher of, weekly periods — all from the timetable), this month's Attendance Summary, and
      Deactivate / Reactivate.

    **Backend:**
    - New `GET /staff-attendance/users/:id/summary?month=YYYY-MM` for Principal and Admin. Working days run from the
      month start (or the join date) to today, minus Sundays and holidays, which are the days student attendance
      counts. Each day is present (punched), leave (approved leave) or absent. Today counts only once punched or on leave.
    - `GET /users/teachers/:id` also returns `academicBackground`, `createdAt`, `periodAssignments`,
      `classTeacherFor` and `timetablePeriodCount`. The fields are additive, so the web edit page is unchanged.

    **Not built, on purpose:**
    - *Import Teachers*, period assignment and Reset Password stay on the web.
    - *Teacher Attendance* as a school-wide screen isn't built; the profile shows each teacher's month.
    - The blueprint's *Female / Male* tiles, *EMP ID* and *department* have no data in the schema.

    **Verified:**
    - [staffMonthSummary.test.ts](../../backend/tests/staffMonthSummary.test.ts) against a real database: holiday,
      Sundays, approved vs rejected leave, leave crossing a month, punched leave day, today, join date mid-month,
      future and past months, other school and non-staff 404.
    - [teacher_management_test.dart](../../mobile/test/teacher_management_test.dart) — 17 tests: timetable
      derivations, search, payloads, CSV, paging, local filters, Inactive tab, profile, an attendance error that
      leaves the profile usable, deactivate confirm, edit, form validation, and layouts at 320dp with 1.3× text and
      at 1200dp. They caught an unhandled attendance error and a header chip overflow; both are fixed.
    - Over HTTP: summary 200; bad month, missing month or bad id 400; unknown id 404; teacher 403 on the summary
      and on the teacher detail; no token 401. A teacher who joined and punched today returned 1/1 = 100%.
      The detail's periods matched the list row. Create 201, duplicate phone 409, edit with a cleared email 200,
      deactivate 204 (inactive count +1), activate 200.

    The Students screens' private action button, filter chip, sheet picker, profile action and info section moved to
    [management_widgets.dart](../../mobile/lib/features/principal/widgets/management_widgets.dart) so both screens
    share them. The student tests still pass.

#### Periods: the web divides by six days, the backend fills five
The web counts assigned periods over Monday–Saturday (`6 × periods`), but the backend only creates Monday–Friday rows.
A fully booked teacher therefore shows at most 40/48. The app matches the web. Fixing it would change the web too, so
it is left for a decision.
22. ✅ School Profile — [school_profile_screen.dart](../../mobile/lib/features/principal/school/school_profile_screen.dart)
    and [edit_school_profile_screen.dart](../../mobile/lib/features/principal/school/edit_school_profile_screen.dart), from More.
    Logo, code and status; Quick Stats (students, teachers, classes); Basic Information, Contact and Address; Edit with the
    web Settings form's text fields.
    - `PATCH /settings/school-profile` replaces the whole profile: a missing `logoUrl` clears the logo and a missing
      `timetablePeriodCount` resets it to 8. The app always sends both back unchanged.
    - **Not built, on purpose:** logo upload and periods per day stay on the web. The blueprint's map, email and Important
      Documents have no data in the schema.
23. ✅ Classes & Sections, Subjects —
    [classes/](../../mobile/lib/features/principal/classes/) (list, detail, add/edit) and
    [subjects_screen.dart](../../mobile/lib/features/principal/subjects/subjects_screen.dart), from More and Quick Add.
    - **Classes:** totals, search, class cards; detail with the last 30 days' stats, subjects and students; the web New
      Class form's fields.
    - **Academic year:** a new class goes in the school's *current* academic year (`GET /academic-years/current`), which is
      the year `GET /classes` lists. The web form defaults to the calendar year ("2026-27"), so a class made there can
      vanish from the list while the school is still on "2025-26". It falls back to that default only when no year is current.
    - **Subjects** belong to a class; the screen adds to or removes from one class at a time.

    **Backend:**
    - Editing a class's subjects used to delete and recreate every subject row. Exams, homework, results and timetable
      periods point at subjects with an optional relation, so each edit would have set those links to null. The web never
      edited subjects after creation, so it never showed. `replaceClassSubjects` now matches by name, case-insensitively:
      kept subjects keep their row, new ones are added, and removing one that is still used returns **409
      `SUBJECT_IN_USE`** before anything in the request is changed.
    - `PATCH /classes/:id` was the only classes handler not wrapped in `asyncHandler`. Any error in it, including its 404,
      became an unhandled rejection and the request hung until the client timed out. It is wrapped now.

    **Verified:**
    - [classSubjects.test.ts](../../backend/tests/classSubjects.test.ts) against a real database: rows kept on add,
      case-insensitive match, 409 leaves class and subjects unchanged, unused subject removed, other fields leave subjects alone.
    - Over HTTP: class created 201 and its class teacher saw it in `GET /classes` and the Marks class picker; adding Science
      kept English's id; removing a subject with an exam 409; removing an unused one 200; teacher create 403. Profile edit
      200 and re-read with the period count kept; teacher 403.
    - [school_and_classes_test.dart](../../mobile/test/school_and_classes_test.dart) — 16 tests, including layouts at 320dp
      with 1.3× text.
24. ✅ Fees Management (**principal only**) — [fees/](../../mobile/lib/features/principal/fees/), from More (Fee Management,
    Fee Reports), the Home Defaulters and Collected cards, a Record Payment quick action, fee alerts and the Student
    Profile Fees tab.
    - **Fee Management:** the web Collection Command Center — six KPI cards, Record Payment, Send Reminder, collection
      snapshot with aging buckets, the largest pending accounts and the fee structures (read-only).
    - **Ledger:** summary, current due, assignments, concessions, and every payment with Receipt PDF (share sheet) and WhatsApp.
    - **Record Payment:** find the student, then the web PaymentModal's form and validation, and the receipt.
    - **Fee Reports:** the web Defaulter Follow-up Queue — search, class, status, due age and sort, with the web's WhatsApp
      reminder text word for word.
    - Each payment form sends one `Idempotency-Key` for its lifetime, so a retry or a replay after a token refresh records
      the payment once.
    - **Not built, on purpose:** fee structure create/edit, concessions and accountants stay on the web.

    **Verified:**
    - [feeRoleAccess.test.ts](../../backend/tests/feeRoleAccess.test.ts) walks every route the fees router declares, plus
      `/reports/fees/pending`: a teacher gets 403 on all 26, no token 401, and a principal reaches validation.
    - Over HTTP: UPI without a transaction id 400; payment 201; the same request with the same key returned the same receipt
      and the ledger rose by the amount once; receipt PDF 200 starting `%PDF`.
    - [fee_management_test.dart](../../mobile/test/fee_management_test.dart) — 15 tests. They caught two overflows at 320dp
      and a validation message that read "Upi payments"; all fixed.

### Phase 6 — Calendar, Reports, Exams
25. ✅ **Backend:** `CalendarEvent` model (EXAM/EVENT/MEETING) +
    [migration](../../backend/prisma/migrations/20260911000000_add_calendar_events/migration.sql) +
    [calendar module](../../backend/src/modules/calendar/) — `GET /calendar?month=YYYY-MM` for Principal, Admin and
    Teacher; `POST /calendar/events`, `PATCH` and `DELETE /calendar/events/:id` for Principal and Admin →
    **verified:** a holiday created through the existing `POST /attendance/holidays` came back from `/calendar` as a
    `HOLIDAY` item on the same date. See "Holidays are not a calendar type" below.
26. ✅ Academic Calendar — **principal side (2026-09-14):**
    [academic_calendar_screen.dart](../../mobile/lib/features/principal/calendar/academic_calendar_screen.dart) is the
    teacher's month view plus Add New Event, and tapping an event opens
    [event_form_screen.dart](../../mobile/lib/features/principal/calendar/event_form_screen.dart) to edit or delete it. It
    opens from More, Quick Add (Create Event / Notice) and a Home quick action. Holidays can't be edited here; they lock
    attendance and stay in Attendance on the web. The grid moved to
    [school_calendar.dart](../../mobile/lib/core/widgets/school_calendar.dart), shared by both apps →
    **verified over HTTP:** principal event 201 appeared in the teacher's month; edit 200; delete 204.
    **Teacher side:**
    [Calendar screen](../../mobile/lib/features/teacher/calendar/teacher_calendar_screen.dart) with a month grid showing
    a dot per event type, a legend that doubles as the filter, and the month's events below; tapping a day narrows the
    list to it. It opens from both the Calendar tab and the Home quick action. **The principal side (Add New Event) is not built
    yet** — the endpoints exist, only the screen is missing →
    **verified:** 4 widget tests in [teacher_calendar_test.dart](../../mobile/test/teacher_calendar_test.dart) — a
    legend entry hides and restores its type, a day inside a multi-day exam lists only that exam, and paging to the
    next month re-requests it and drops the day selection.
27. ✅ Reports **without Finance** — [reports/](../../mobile/lib/features/principal/reports/), the principal Reports tab and
    More. Quick Access: Student, Attendance, Teacher and Exam reports. Detailed Reports: Class Wise Performance, Subject Wise
    Performance and Daily Attendance. Every report exports CSV.
    - **Attendance:** the web Daily Attendance Report — Today / Yesterday / This week / This month, classes marked, rate,
      pending classes with Nudge Teachers, the web's CSV. Home's Marked Today card and low-attendance alerts open it.
    - **Student Report:** the risk summary the web Analytics page reads, with every `FEE_*` flag removed and the severity
      recomputed without it by the server's own rule. Students flagged only for fees drop out. Home's Alerts card opens it.
    - **Teacher Report:** the web Teacher Performance logic. **Class / Subject Wise:** month attendance with exam averages
      weighted by marks entered.
    - Blueprint *Fee*, *Transport*, *Custom Reports* and *Report History* tiles are not built: Finance is excluded by
      decision, and the others have no backend.

    **Verified:**
    - [reports_test.dart](../../mobile/test/reports_test.dart) — 15 tests. No text containing fee, finance, ₹ or Rs. on any
      report screen. Real risk-summary rows keep no fee flag. Layouts at 320dp with 1.3× text.
    - Over HTTP: principal 200, teacher 403 on all four report endpoints.
    - The real responses parsed into the app models. On the demo school all 21 risk rows were fee-only, and none remained.
28. ✅ Exams management — [exams/](../../mobile/lib/features/principal/exams/) (list by class and stage, Schedule Exam,
    results where the principal enters or amends any mark), from More and the Exam Report tile. **Teacher app:** Marks gains
    **Create Test** (Unit or Class Test, as the server allows teachers), and the new test is selected for marks entry. Both
    use [schedule_exam_screen.dart](../../mobile/lib/core/widgets/schedule_exam_screen.dart); exam models moved to
    [exam_models.dart](../../mobile/lib/core/data/exam_models.dart).
    - **Backend:** `POST /marks/exams` accepted an exam only together with marks for at least one student, so neither app
      could schedule one. `results` now defaults to empty. Marks are then entered per student through
      `PATCH /exams/:id/results`, which already created a result on first save. The web still sends marks with the exam,
      so it is unchanged.
    - The stage comes from the counts (Scheduled / Marks pending / Marks entered). The server's `status` calls any exam
      dated today or earlier "marks entered" even with none.
    - **Web parity:** scheduling an exam without marks is app-only for now; the web exams pages still take marks at creation.

    **Verified:**
    - [marksExamTerm.test.ts](../../backend/tests/marksExamTerm.test.ts) — schedule without results, marks above max still
      rejected.
    - [classSubjects.test.ts](../../backend/tests/classSubjects.test.ts) — a scheduled exam is in the class teacher's list.
    - Over HTTP: teacher Class Test 201 with 0 entered; teacher Mid-Term 403; principal Mid-Term 201 and in the teacher's
      Marks list; teacher marks 200, re-entry 403, principal amend 200.
    - [exams_and_calendar_test.dart](../../mobile/test/exams_and_calendar_test.dart) — 11 tests.

#### Holidays are not a calendar type
`Holiday` already exists, and it is what locks attendance marking for a day. A `HOLIDAY` calendar event would look the
same on the calendar but would not lock attendance, so the two could disagree. The enum therefore has no `HOLIDAY`:
the month endpoint merges `Holiday` rows in as `type: "HOLIDAY"`, `source: "HOLIDAY"`, and `POST /calendar/events`
rejects that type with 400. Holidays are still created through the attendance endpoints the web dashboard already uses.

Rows from the `Exam` table are not merged in either. There is one per class and subject, so a single exam week would
flood the grid. A school marks the week itself as one `EXAM` event.

Dates travel as plain `YYYY-MM-DD` strings. Events are stored at midnight UTC, like leave; holidays keep the
server-local midnight the attendance module has always used, and are formatted the way that module formats them.

**Verified** by [calendar.test.ts](../../backend/tests/calendar.test.ts) against a real database — an event crossing
a month boundary appears in both months, another school's events never appear, and it covers role checks, a reversed
date range, update and delete. **Also verified over HTTP** against a local backend. Teacher: GET 200, bad month 400,
create / edit / delete 403. Principal: create 201; 31 February, `HOLIDAY` and an end before the start all 400; edit
200; delete 204; a second delete 404.

> **Still not device-tested,** as with Phases 0–4. The teacher APK builds; nobody has opened the calendar on a handset.

### Phase 7 — New modules
29. ✅ **Backend + UI:** bell timings. One school-wide bell: a
    [`PeriodTime` table](../../backend/prisma/migrations/20260911120000_add_period_times/migration.sql),
    `GET`/`PUT /settings/period-times` for Principal and Admin, and a **Bell Timings** section on the web dashboard's
    Settings page. `GET /users/me/schedule` now carries each period's `startTime`/`endTime`, and the teacher Home
    shows the time plus the blueprint's **Now** / **Upcoming** badges. Period assignment stays on the existing web
    grid; the principal app's Timetable tile reads that grid (see Timetable in both apps, below) →
    **verified:** [periodTimes.test.ts](../../backend/tests/periodTimes.test.ts) against a real database
    (out-of-range, reversed, zero-length, overlapping and duplicate periods rejected; untimed periods carry nulls;
    lowering Periods Per Day hides later times); 7 unit tests in
    [schedule_badges_test.dart](../../mobile/test/schedule_badges_test.dart); and over HTTP — teacher 403 on read and
    write, a malformed time 400, overlapping periods 400, save 200, and the teacher's schedule came back as
    `P1 08:00-08:45`.
30. ✅ **Backend + UI:** Transport, records only (no live tracking), agreed with the user 2026-09-17.
    - **Data** ([migration](../../backend/prisma/migrations/20260917000000_add_transport/migration.sql)): `TransportVehicle`
      (registration, seats, driver name and phone; drivers don't log in, so they have no table), `TransportRoute` (name,
      optional vehicle) with ordered `TransportStop`s (pickup and drop times), and `transportRouteId` / `transportStopId` on
      `students`.
    - **API** ([transport module](../../backend/src/modules/transport/)), Principal and Admin only: `GET /transport`,
      `GET /transport/report`, vehicles and routes create / edit / delete, `GET /transport/routes/:id` with its riders,
      `POST /transport/assignments` (moves students off any other route) and `DELETE /transport/assignments/:studentId`.
    - **Fees are never touched.** Assigning, moving or removing a rider leaves `transportRequired` and the transport fee as
      they were. The report lists the two mismatches instead: marked as needing transport but on no route, and riding a
      route while not marked.
    - Registration numbers are stored without spaces or dashes, upper case, unique per school; route names are unique
      regardless of case. Editing a route keeps a stop sent with its id, so its riders stay; riders at a removed stop stay on
      the route with no stop. Deleting a vehicle leaves its routes without one; deleting a route leaves its riders without one.
    - **Web:** [Transport](../../frontend/src/app/(app)/transport/page.tsx) page (sidebar, after Payroll) and
      [Transport Report](../../frontend/src/app/(app)/reports/transport/page.tsx) (Reports, CSV and PDF).
    - **App:** More → Transport ([transport/](../../mobile/lib/features/principal/transport/)): routes and vehicles tabs, route
      detail with Call Driver, add/edit route and vehicle, Add Students by class; and a Transport Report tile in Reports,
      with no fee wording.

    **Verified:**
    - [transport.test.ts](../../backend/tests/transport.test.ts) against a real database: normalised and duplicate
      registrations, per-school isolation, case-insensitive route names, stop edits keeping riders, moving between routes,
      inactive and other-school students refused, over-capacity and per-stop counts, fees unchanged, deletes, teacher 403.
    - The migration applied cleanly to a copy of the local demo database with data.
    - Over HTTP against that copy: vehicle 201, duplicate 409, bad phone and zero seats 400, route 201, same name in another
      case 409, `7:10` 400, assign 200, unknown route 404, unassign 204; teacher 403 on read and write; no token 401.
      The report on real students matched SQL: 2 students marked as needing transport, both assigned, so 0 need a route;
      4 riders on a 2-seat bus showed 200% and over capacity; the 2 unmarked riders were listed.
    - [transport_test.dart](../../mobile/test/transport_test.dart), 16 tests, including layouts at 320dp with 1.3× text. They
      caught two chips too long to fit at that size; both are plain text now.
    - **Not yet:** the web pages have not been opened in a browser, and the app screens have not been opened on a phone.
31. ✅ **Backend + UI:** Payroll — a `SalarySlip` table
    ([migration](../../backend/prisma/migrations/20260913000000_add_salary_slips/migration.sql)) and
    [payroll module](../../backend/src/modules/payroll/): `GET /payroll/me/slips` for any staff member (own slips only,
    there is no user id to pass), `GET /payroll/slips?month=`, `PUT /payroll/slips` (create-or-replace per person
    and month) and `DELETE /payroll/slips/:id` for Principal and Admin. Figures are recorded, not computed:
    net pay = basic + allowances − deductions. The principal records slips on the new web **Payroll** page; teachers
    read them in the app **Salary** tab ([salary_screen.dart](../../mobile/lib/features/teacher/salary/salary_screen.dart))
    and on the web **My Salary** page (`/teacher/salary`) →
    **verified:** [payroll.test.ts](../../backend/tests/payroll.test.ts) against a real database, and over HTTP.
    Principal save 200. Recording your own salary 403 `CANNOT_RECORD_OWN_SALARY`. Teacher write 403, teacher reading
    the month sheet 403. Bad month 400, negative net pay 400, no token 401. A second teacher's `/me/slips` came back
    empty. Widget tests in [salary_screen_test.dart](../../mobile/test/salary_screen_test.dart).

#### Nobody records their own salary
The same rule as leave: a principal or admin is also staff, so `PUT /payroll/slips` returns **403
`CANNOT_RECORD_OWN_SALARY`** when the slip is the caller's, and the month sheet marks that row "Your own".


#### Timetable in both apps (2026-09-19)
The last Phase 7 placeholder. Both screens **read** the timetable; period assignment stays on the web grid, as
decided with item 29, so no new write path and no double-booking rules to re-implement on a phone. No migration —
`TeacherPeriodAssignment` already carries `classId`, and `PeriodTime` the bell.
- **API:** `GET /classes/:id/timetable` pivots the per-teacher assignments into one class's week. Every period
  `1..periodCount` is present on every weekday with nulls for free slots, so the app lays out a grid without filling
  gaps. Access follows its sibling class reads: Principal and Admin see any class, a teacher only one they teach.
  `GET /users/me/schedule/week` is `GET /users/me/schedule` for all five weekdays at once — that call already loaded
  every weekday and discarded four, and five round trips on a phone is four too many.
- **Double-booked slots are named, not hidden.** `ensureTeacherPeriods` seeds assignments with no conflict check
  (only saving from the web grid checks), so two teachers can hold the same class, day and period. The response
  carries `contestedBy`, and both apps show a **Double-booked** chip. On the local demo data three real slots were
  already contested.
- **Shared:** [timetable_models.dart](../../mobile/lib/core/data/timetable_models.dart) and
  [timetable_week.dart](../../mobile/lib/core/widgets/timetable_week.dart) — day chips over period rows, one widget
  for both apps. The Now/Upcoming rule moved here as `periodBadges`; `scheduleBadges` now delegates to it, so the
  teacher Home and the new screens cannot drift apart.
- **Principal app:** More → Timetable ([timetable/](../../mobile/lib/features/principal/timetable/)) — class picker,
  weekday chips, each period with its bell time, subject and teacher, and a note saying periods are assigned on the
  web dashboard.
- **Teacher app:** My Timetable ([timetable/](../../mobile/lib/features/teacher/timetable/)), opened from **View week**
  on Home's Today's Schedule. Same layout, with the class opposite the subject instead of the teacher. Home's header
  now shows that link in place of its "N periods" count; the list below it already says as much.

**Verified:**
- [timetable.test.ts](../../backend/tests/timetable.test.ts) against a real database (`npm run test:timetable`): the
  grid carries every period on every weekday, free slots come back all null, an untimed period carries null times, a
  contested slot reports `contestedBy: 1` and names the first teacher alphabetically, another school's class 404s, a
  teacher who teaches the class may read it and one who does not 404s, and a teacher's own week carries only their
  own rows and drops periods with no class.
- Over HTTP against a copy of the local demo database with data: class timetable 200 with 8 periods on each of 5
  days; the three `contestedBy` slots matched SQL exactly (Mon P5, Thu P3, Fri P6); the teacher's week returned 7
  periods a day, matching SQL; teacher reading a class they teach 200, unknown class 404, no token 401 on both
  endpoints.
- [timetable_test.dart](../../mobile/test/timetable_test.dart), 17 tests, including both screens at 320dp with 1.3×
  text. That caught a real overflow: the double-booked chip was originally "+N more assigned", 34px too wide, and is
  plain "Double-booked" now. The full mobile suite (189 tests) passes and both APKs build.
- **Not yet:** neither screen has been opened on a phone.

### Teacher dashboard: web and app are one (2026-09-13)
Both read `GET /dashboard`, `GET /users/me/schedule` and `GET /staff-attendance/me/today` and show the same sections
in the same order: pulse line → KPI cards (Assigned Students, Pending Attendance, Pending Homework, Assigned Classes)
→ today's punch and schedule → per-class attendance → Today's Actions (Marked / Unmarked / Homework) → alerts.
- **App Home** ([teacher_home_screen.dart](../../mobile/lib/features/teacher/teacher_home_screen.dart)) adopted the web's
  KPIs, pulse sentence, class attendance, Today's Actions and alerts. Greeting and Quick Actions stay app-only; on the
  web, the page title and sidebar do those jobs.
- **Web** ([TeacherDayPanel.tsx](../../frontend/src/features/dashboard/TeacherDayPanel.tsx)) gained Today's Punch and
  Today's Schedule. Its Now/Upcoming rule is a line-for-line port of the app's `scheduleBadges`.
- The web Activity feed is not on the app. It reads school-wide audit logs, which are not teacher data.

### One look across web and apps (2026-09-13)
[app_colors.dart](../../mobile/lib/core/theme/app_colors.dart) now carries the web's tokens from `globals.css` —
brand #2456E6, ink/surface/border greys, success/warning/danger — plus the web's KPI card palette and 6/8px radii.
Inter is bundled (`assets/fonts`, SIL OFL), so text matches the web offline too. A `KpiCard` widget reproduces the web
KPI card. This lives in `core/`, so the principal app changed as well.

Responsiveness is one layer, [responsive.dart](../../mobile/lib/core/widgets/responsive.dart):
- `AppViewport` (MaterialApp.builder) caps content at 840dp, centred, on tablets and in landscape.
- System font scaling is honoured up to 1.3×.
- `ResponsiveGrid` picks columns by width (small phone / phone / wide) and sizes rows to their content, so scaled
  text is never clipped.

**Verified:** [teacher_dashboard_test.dart](../../mobile/test/teacher_dashboard_test.dart) renders Home at 390dp, at
320dp with 1.3× text, and at 1200dp. The 320dp run caught a real overflow in the shared brand header, now fixed. Both
APKs build.

> **Still not device-tested,** as with Phases 0–6. The web pages pass `tsc` but have not been opened in a browser.

### First device run (2026-09-17)
Both debug APKs on an Android 13 phone (OPPO CPH2263, 360dp wide) against staging, school SS000001.

**Opened and working:** principal Home, School Profile, Classes & Sections and a class, Subjects, Fee Management, a fee
ledger, Record Payment (validation only, nothing recorded), Defaulter Follow-up, Exams, Academic Calendar (an event
added, opened and deleted), and the Student, Attendance and Teacher reports; teacher Home, Marks, Create Test (form
only), Students Needing Focus, Apply Leave (form only) and Salary.

**Fixed:**
- **Pushed screens could not find their repository.** `PrincipalRepository`, `TeacherRepository` and `PunchController`
  were provided around the shell, but screens opened with `Navigator.push` sit under the Navigator, not the shell.
  On the phone School Profile showed "Unable to load the school profile." Widget tests missed it because they put
  providers above `MaterialApp`. `SmartShalaApp` now takes `sessionProviders` and mounts them above the Navigator,
  keyed by the signed-in user's id so a different user still gets fresh ones →
  **verified:** [session_providers_test.dart](../../mobile/test/session_providers_test.dart) pumps the real app and
  reads a provider from a pushed route; it fails with the old placement. On the phone, School Profile and teacher
  Marks load.
- **Pull-to-refresh threw** "setState() callback argument returned a Future" (principal Home, teacher Home, Homework,
  Salary, Students Needing Focus, and Retry on Add Student) → reproduced in logcat, gone after the fix.

**Open, for a decision:** a subject teacher with periods in a class sees that class in Marks, but Create Test says
"This class has no subjects you can examine". The backend lets a teacher examine a subject only when they are its
`Subject.teacherId` or the class teacher, and `ensureClassSubjects` assigns every subject to the class teacher.
Period assignments (which carry `subjectId`) are not considered. This rule also applies on the web.

### Phase 8 — Polish & release
32. **Blocked, not started.** Push notifications (`DeviceToken` + FCM) → **verify:** an announcement triggers a device
    notification. There is no Firebase project and no `google-services.json` anywhere in the repo, and
    `firebase_messaging` cannot be added to the app without one. Open question 2 (per-device or per-user tokens) is
    still unanswered. Nothing was stubbed: a half-wired FCM path that cannot be delivered to or tested is worse than
    an honest gap. **Needs from the owner:** a Firebase project for the two application IDs, its
    `google-services.json`, a service account for the backend, and the per-device/per-user decision.
    The principal app's **Notifications** tile stays a placeholder for the same reason — the in-app feed it would
    otherwise show is already the Messages tab in both apps (announcements with per-user read state, plus leave).
33. ✅ **Audited, already in place.** Every screen was checked for the four states. Loading, error with retry, and
    empty are on every screen that loads data; the two Calendar screens looked bare only because they delegate to the
    shared [school_calendar.dart](../../mobile/lib/core/widgets/school_calendar.dart), which has all four. Screens
    with no pull-to-refresh are forms and pickers, where it would do nothing. No changes were needed.
34. ✅ **Long lists build on demand** (2026-09-19). Nine lists were already lazy (`ListView.separated`); the rest were
    eager `ListView(children: [...])`, which builds every row before the first frame. That is fine for a form or a
    class roster and wrong for a list as long as the school.
    - New [list_with_header.dart](../../mobile/lib/core/widgets/list_with_header.dart): a `ListView.builder` whose
      first item is the screen's existing header, with optional `empty` and `footer` slots. It sets
      `AlwaysScrollableScrollPhysics` so a short or empty list still drags — otherwise pull-to-refresh dies on exactly
      the screens with nothing to show.
    - Converted the five school-scale lists: **Defaulter Follow-up** (every pending account), **Student Report**
      (every flagged student), **Student Management** and **Teacher Management** (both grow without limit through
      Load More, which is now the `footer`), and the teacher's **Students Needing Focus**.
    - **Left alone on purpose:** class rosters (Mark Attendance, Marks, Exam Results, Class Detail), route riders,
      one student's fee ledger, and the per-class and per-teacher report rows. All are bounded by class size or class
      count, and converting them would be churn.
    - **Offline** needs no work beyond what exists: the Phase-0 decision is online-only with explicit error and retry,
      and `ApiException.fromDio` already turns a connection failure into a plain "Cannot reach SmartShala. Check your
      internet connection." that every `ErrorView` shows with a Try again button.

    **Verified:** [list_with_header_test.dart](../../mobile/test/list_with_header_test.dart), 7 tests — a 500-row list
    builds under 60 rows and never builds row 499, scrolling still reaches row 400, the empty slot replaces the rows
    while keeping the header, the footer sits after the last row and survives an empty list, and a fling on an empty
    list fires pull-to-refresh. Plus a screen-level guard in
    [fee_management_test.dart](../../mobile/test/fee_management_test.dart): Defaulter Follow-up with 400 students
    builds fewer than 200 cards and leaves the last row unbuilt. The whole mobile suite (197 tests) passes, `flutter
    analyze` is clean and both APKs build.
35. **Blocked, not started.** Play Store release prep: icons, splash, signing, privacy policy, internal testing track.
    **Needs from the owner:** an upload keystore (and somewhere safe to keep it), a Play Console account with the two
    listings created, store assets, and a publicly hosted privacy policy URL.

---

## 7. Suggested build order rationale

Phase 2 (teacher daily loop) ships first because Swipe To Punch + Mark Attendance is the highest-frequency,
highest-value interaction in the whole product and is mostly backed by APIs that already exist. Principal
management screens (Phase 5) are largely a mobile re-skin of the existing web dashboard, so they carry less
risk and can follow. The genuinely new backend domains — Leave, Payroll, Transport, Timetable, Calendar —
are sequenced so each lands right before the screens that consume it.

---

## 8. Open questions

The nine questions that opened this plan are all answered in **Decisions taken** at the top.
What remains open is scoped to later phases:

1. ~~**Period times for the timetable**~~ — answered 2026-09-11: one school-wide bell, set on the web dashboard.
2. **Push notification provider** (Phase 8). FCM is assumed; needs a Firebase project and a decision on
   whether notifications are per-device or per-user.
3. **Play Store listings** (Phase 8). Two listings mean two sets of store metadata, screenshots and
   privacy declarations.

## 8a. Backend changes made for the mobile apps

| Change | Why |
|---|---|
| `StaffAttendance` model + [migration](../../backend/prisma/migrations/20260905000000_add_staff_attendance/migration.sql) | Nothing recorded staff punches before. |
| [staffAttendance module](../../backend/src/modules/staffAttendance/) | `/staff-attendance/me/today`, `/punch-in`, `/punch-out`, `/history`. Restricted to PRINCIPAL, ADMIN, TEACHER. |
| `getRefreshToken` also reads `body.refreshToken` | The refresh token lives in an httpOnly cookie, which a native client has no jar for. Cookie still wins when present, so web is unchanged. |
| Login returns `refreshToken` only for `x-client-type: mobile` | Keeps the token out of web responses, where the httpOnly cookie is the security boundary. |
| `GET /users/me/schedule` | The teacher's own timetable for a weekday. The existing assignments endpoint is admin-only and returns free periods. |
| `GET /students/needing-focus` | Teacher-accessible focus list. `analytics.riskSummary` could not be reused: it is principal-only and weighs pending fees, which teachers must never see. |
| `transportFeeAmount` grouped with the fee fields | It is a fee figure on the student row, so it was reaching teachers through the base column spread. Principals and accountants still receive it. |
| `LeaveRequest` model + [leave module](../../backend/src/modules/leave/) | Nothing recorded staff leave before. `/leave/requests` (apply, own list, school-wide list), `/requests/:id/decision`, `/requests/:id/cancel`, `/requests/:id/attachment`. |
| `Announcement` + `AnnouncementRead` models + [announcements module](../../backend/src/modules/announcements/) | The existing `Notification` model is a WhatsApp/SMS delivery log keyed by a parent's phone number, so it could not back an in-app feed with per-user read state. |
| Leave and announcement lists return their own tile counts | The mobile stat rows would otherwise need a second request per screen, and could drift out of step with the list above them. |
| `CalendarEvent` model + [calendar module](../../backend/src/modules/calendar/) | Nothing but holidays had a date on a school calendar. `/calendar?month=` merges events with the existing holidays; `/calendar/events` is the principal-only CRUD. The holiday endpoints are untouched. |
| `SalarySlip` model + [payroll module](../../backend/src/modules/payroll/) | Nothing recorded pay before. `/payroll/me/slips` (own, any staff), `/payroll/slips` month sheet + save + delete (Principal/Admin). |
| `PeriodTime` model + `/settings/period-times` | Periods had a number but no clock time. `GET /users/me/schedule` adds `startTime`/`endTime` to each period (null when unset); its other fields are unchanged. |
| `GET /classes/:id/timetable` + `GET /users/me/schedule/week` | The apps needed a class's week and a teacher's whole week. Both are reads over the existing `TeacherPeriodAssignment` rows — no migration. `contestedBy` names a slot two teachers hold. |
| `POST /marks/exams` `results` optional (default empty) | Lets both apps schedule an exam before marks exist. The web still sends marks. |
| Class subject edits keep existing rows; removing a used subject 409 `SUBJECT_IN_USE` | The old delete-and-recreate set exam, homework and timetable links to null. |
| `PATCH /classes/:id` wrapped in `asyncHandler` | Its errors were unhandled rejections and the request hung. |

None of these change existing web behaviour for principal/admin roles. `npm run lint` (tsc) passes.

---

## 9. Files & conventions

- Blueprint PDF: `docs/product/SmartShala_App_V2_0_Product_UI_Blueprint.pdf` (~17 MB — consider Git LFS)
- This plan: `docs/product/APP_V2_IMPLEMENTATION_PLAN.md`
- Mobile apps: [mobile/](../../mobile/) — see [mobile/README.md](../../mobile/README.md) to run them
- Backend API base (multi-tenant): `/:schoolId/api/v1/...`
- New backend work follows the existing module shape: `<module>.routes.ts` / `.controller.ts` / `.service.ts` / `.schemas.ts`

## 10. How to verify what has been built

```bash
# Backend typecheck
npm --prefix backend run lint

# Punch state machine against a real database
DATABASE_URL=<postgres url> npm --prefix backend run test:staff-attendance

# Teacher fee isolation + focus thresholds
DATABASE_URL=<postgres url> npm --prefix backend run test:teacher-access

# Leave decision rules + announcement audience and read state
DATABASE_URL=<postgres url> npm --prefix backend run test:leave

# Calendar month overlap, holiday merge, school isolation and edit rights
DATABASE_URL=<postgres url> npm --prefix backend run test:calendar

# Bell timing validation and the times on a teacher's schedule
DATABASE_URL=<postgres url> npm --prefix backend run test:period-times

# Payroll: own-salary rule, role checks, net pay, school isolation
DATABASE_URL=<postgres url> npm --prefix backend run test:payroll

# Staff month summary: working days, leave, join date, school isolation
DATABASE_URL=<postgres url> npm --prefix backend run test:staff-summary

# Every fee route refuses a teacher (no database needed)
npm --prefix backend run test:fee-access

# Class subject edits keep linked rows; scheduled exams reach the teacher
DATABASE_URL=<postgres url> npm --prefix backend run test:class-subjects

# Mobile analyzer + swipe-gesture tests
cd mobile && flutter analyze && flutter test

# Both APKs
cd mobile
flutter build apk --debug --flavor teacher   -t lib/main_teacher.dart
flutter build apk --debug --flavor principal -t lib/main_principal.dart
```

To run the teacher app against a local backend, start the API on port 4000 and launch with the
emulator's host alias (the default `API_BASE_URL` already points at `http://10.0.2.2:4000`). Sign in
with the school code (e.g. `SS000001`) plus a teacher's phone/email and password.
