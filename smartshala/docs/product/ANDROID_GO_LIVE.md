# Android go-live — what is actually left

Written 2026-10-20 from a sweep of `mobile/`, the backend and the web, against
[PLAY_STORE_RELEASE.md](PLAY_STORE_RELEASE.md) (listing mechanics live there, not here).

Both apps are already signed and on Play **internal** testing (v1.0.0+2, 2026-10-18). Going to
production today is possible: no missing module blocks it. What blocks it is four code fixes, one
deploy, and the Play Console paperwork only you can fill.

---

## A. Must fix before the build we publish

**1, 2 and 4 are done** (2026-10-20, working tree): `flutter analyze` clean, 276 mobile tests pass,
`tsc --noEmit` clean. Only 3 -- the commit and the production deploy -- is left.

1. ~~**The Notifications tile is a visible placeholder.**~~ **Fixed:** the tile is gone, and with it
   `placeholder_screen.dart` and the `phase` plumbing -- a module now has to name a screen, so no
   placeholder can ship again. Messages carries the feed.
   <details><summary>was</summary>
   `principal_more_screen.dart:113` has no screen, so it opens "This section arrives in a later
   phase of the V2 rollout." That text cannot ship.
   → **Decision needed:** remove the tile (Messages already shows announcements + leave with
   per-user read state), or point it at `GET /notifications`. That endpoint is the *message log*,
   whose rows say SENT for messages nothing ever sent — see 3.

2. ~~**The app claims WhatsApp messages were sent. Nothing is sent.**~~ **Fixed:** every claim now says
   *queued*, in both apps and on the web -- the defaulter toast, the receipt toast, the receipt dialog
   line and button, the Record Payment checkbox ("Queue a WhatsApp receipt for the parent / On by
   default. WhatsApp delivery is not live yet."), plus the web dashboard nudge, analytics nudges, fee
   pages and PaymentModal. Buttons still read "Send WhatsApp" -- pressing send to queue is normal; what
   was wrong was reporting delivery that never happened.
   <details><summary>was</summary>
   Every sender in the backend is a stub (`whatsapp.service.ts` returns `"dry-run"`), yet the app
   says *"WhatsApp reminder sent to Rahul."* (`defaulters_screen.dart:68`), *"Receipt 1041 sent on
   WhatsApp."* (`student_fee_ledger_screen.dart:88`) and offers *"Send receipt to parent on
   WhatsApp"* as a checkbox (`record_payment_screen.dart:308`).
   → Reword to what is true ("Reminder queued") or hide the actions until real delivery exists.
   A principal who sees "sent" and gets a parent complaint is the worst version of this bug.</details>

3. **The in-flight attendance-LEAVE batch is uncommitted and undeployed.**
   20 mobile files, 2 new screens, backend schema + two migrations
   (`20261019000000_add_attendance_leave`, `20261019010000_attendance_three_states`) are all
   working-tree only. A published release talks to **production** — so prod must have these
   migrations before the app that sends `LEAVE` reaches anyone.
   → Commit, push, deploy to the VPS, then build the release from that commit.
   Migration pre-flight: the enum is *rebuilt* (Postgres cannot drop a value), it folds existing
   `LATE`/`HALF_DAY` rows into `PRESENT` at value 1.00, and it runs across all 16 tenant DBs —
   one failure blocks every boot (P3009). Back up first, watch `_prisma_migrations.logs`.

4. ~~**Leftover from that batch, on the web:**~~ **Fixed:** the legend is Present / Absent / Leave /
   Holiday, Leave in the same teal the calendar already paints it.
   <details><summary>was</summary> the student-profile attendance calendar still shows
   **Late** and **Half Day** legend chips and no Leave chip
   (`AttendanceTabPanel.tsx:228`), though those statuses no longer exist. Web only, but it is in
   the same change and should go out with it.

---

## B. Bugs and logical gaps found, not blockers

- **No 402 handling.** A lapsed school gets `402 SCHOOL_INACTIVE` on every call; the app shows the
  raw server message in an error card and keeps the session. The web has a dedicated
  subscription-expired page. Mid-session it should sign out to a clear screen.
- **Forgot password tells the principal to ask the principal.** The dialog says "contact your
  principal or school admin" in *both* apps; for the principal app the real path is the super-admin
  password-reset queue. One sentence per flavor.
- **No version gate and no crash reporting.** Once installs are in the wild, a breaking API change
  breaks old builds silently, and you will not hear about a crash. A `GET /health`-style minimum
  version check is cheap insurance; Crashlytics needs the same Firebase project push does.
- **Breaks parity.** The web Teacher Attendance page gained a Breaks column with the day's break
  list (42d6bf1); the principal app's screen still only says "on a break".
- **Production is running with the billing worker and Razorpay off**
  (`BACKGROUND_WORKERS_ENABLED=false`, `RAZORPAY_MODE=mock`). Nothing enforces or collects
  subscriptions on the backend these apps will talk to. Fine for a pilot, not for paid schools.

## C. Modules the apps do not have (web-only), by choice or omission

| Gap | Note |
|---|---|
| Push notifications | Needs Firebase + `google-services.json`. Ship without; Messages covers the feed. |
| Edit a student | The app can add, deactivate and reactivate, but not edit. Web has the form. |
| Create/edit fee structures | App reads `/fees/structures`, cannot write. Fees are otherwise complete. |
| Create admin/accountant users | App creates teachers only. |
| Activity logs, Analytics page | Dashboard and Student Report cover the useful parts. |
| Billing / subscription | **Keep it out.** In-app purchase of a digital subscription would force Google Play Billing and a 15–30% cut. Renewals stay on the web. |
| Payroll, Transport | Hidden behind flags on purpose since 2026-10-12 (web + app + API). |
| iOS | Project generated 2026-10-20; both flavors build, branded and unsigned. Signing is wired to team `759C76D23N` but no archive has ever succeeded — the team has no registered devices, so Xcode cannot mint a profile. Never run on an iPhone. See [APP_STORE_RELEASE.md](APP_STORE_RELEASE.md). |

## D. Non-coding, only you can do these

1. **Privacy policy** — `PRIVACY_POLICY.md` still has `{{ }}`: legal entity name, registered
   address, contact email, contact phone, hosting location, retention period, deletion-response
   days, effective date. Give me those eight and I can publish it at
   `https://app.letssmartshala.com/privacy` today (a public Next route, no auth).
   Publish the 2026-10-18 copy — the older one says the apps never use the camera, which the punch
   selfie made false.
2. **Data safety form**, per app. The appendix at the bottom of the policy is the same list in the
   form's words. The row people get wrong: **Photos — collected, not shared, app functionality,
   optional** (the punch selfie).
3. **Store listing**, per app: short description (80 chars), full description, feature graphic
   1024×500, 4–6 phone screenshots. Icons exist (`mobile/store/*/icon-512.png`); screenshots do
   not — I can take them off your phone. Say in the *Teacher* description that teachers photograph
   themselves at punch-in, or a reviewer holds the app over the unexplained camera.
4. **Content rating questionnaire** — Education, no objectionable content, **not** directed to
   children (staff tool). Answer it the same way in both listings.
5. **Confirm the pilot schools exist in production** with active subscriptions and real teacher
   logins, and that the staff you hand the app to are in the right school.

## E. Publish sequence for today

1. Fix A1–A4 → `flutter analyze`, `flutter test`, backend tests green.
2. Commit, push, `bash deploy/deploy.sh <ref>` on the VPS, verify `/health/db` and that attendance
   marking accepts Leave in the browser against production.
3. `node publish.mjs --flavor both --track internal --build --bump`, install both signed bundles on
   a real phone, sign in against production, walk attendance / fees / punch.
4. Finish D1–D4 in Play Console.
5. Promote internal → production. The 12-testers/14-days rule does not apply to this account.
