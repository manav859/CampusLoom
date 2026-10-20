# SmartShala mobile apps — privacy policy

Published at <https://app.letssmartshala.com/privacy>, which is the URL given to Google Play and the
App Store. It must stay reachable without signing in.

This describes what the apps and the backend in this repository actually do as of 2026-10-20. If the apps
change what they collect — push notifications will add a device token — change this page in the same
commit.

---

**Effective date:** 20 October 2026
**Applies to:** SmartShala Principal (`com.smartshala.principal`) and SmartShala Teacher
(`com.smartshala.teacher`), on Android and iOS, and the SmartShala web dashboard they share.
**Published by:** Hybrid Monks LLP, F1, Bhagwati Complex, Vejalpur, Ahmedabad, Gujarat, India ("we", "us").

## Who uses these apps

Both apps are for **school staff**: a principal or administrator, and teachers. Accounts are not open to the
public — a school creates them, and you sign in with the email address or phone number your school holds for
you and a password it gives you. There are no student or parent accounts in these apps.

Your school decides what information about its students and staff goes into SmartShala and how long it is
kept. We hold that information on the school's behalf and act on the school's instructions.

## What the apps collect

**Your account.** Your name, phone number, role (principal or teacher), your school's code, and the school
and classes you are attached to. Your password is stored only as a cryptographic hash and is never readable
by us.

**What you enter while working.** Depending on your role, that is: student attendance, marks and exam
results, homework and submissions, fee receipts and payment records, leave requests (with an optional
document you attach yourself), staff punch in and punch out times, timetable and calendar entries, transport
routes and who rides them, salary slips your principal records, and messages and announcements.

**Student and parent details entered by school staff.** Name, admission number, class, roll number, parent
name and parent phone number, and anything else the school chooses to record. Students do not use the apps.

**A punch selfie (teacher app only).** When a teacher punches in for the first time that day, the app
opens the phone's camera so they can take a photo of themselves, which is stored with that day's attendance
record and shown to their principal on the school dashboard. It is taken with the front camera, never in the
background, and never without the teacher pressing the shutter. **It is optional:** declining the camera,
closing it, or cancelling still punches the teacher in — the day is simply recorded as having no selfie.
Later punches the same day (returning from a break, or re-opening a day punched out by mistake) never ask
for one. The app does not read your photo gallery, and the photo is not used for face recognition, identity
matching or any automated decision.

**Technical information needed to run the service.** Your sign-in tokens, the app version, and the server
logs any internet service keeps (request times, error traces, and the IP address your phone connects from).

## What the apps do not collect

- **No location.** Punch in and punch out record the time only. There is no geofencing and the apps never ask
  for a location permission.
- **No contacts, no microphone, and no access to your photo gallery.** The camera is used in one place
  only — the punch selfie described above, taken by you, in the teacher app. The apps never read photos you
  already have. The only other file that leaves your phone is a document you pick yourself to attach to a
  leave request.
- **No advertising, and no advertising identifier.** The apps carry no ad SDK and no third-party analytics or
  tracking SDK.
- **No selling of personal information, to anyone, ever.**

## Permissions, and what each one is for

| Permission / capability | Why |
|---|---|
| Internet access | Everything in the apps comes from your school's SmartShala server. |
| Camera (teacher app) | Only when you punch in for the first time on a given day. The phone's own camera takes the photo and hands back the one frame you accepted; the apps cannot open the camera by themselves or in the background. Declining is allowed and still punches you in. On Android no camera permission is declared at all; on iOS the system asks once, the first time. |
| File picker (no storage permission) | Only when you tap Attach on a leave request. The phone's own picker hands us the one file you choose; the apps cannot browse your storage. On iOS that picker can offer your photo library as one place to pick from, so iOS may ask for photo access at that moment — the apps never read the library otherwise, and never at any other time. |
| Opening the dialer or WhatsApp | Only when you tap a phone number on a student, teacher or transport screen. It hands the number to the app you choose and we learn nothing about the call. |
| The share sheet | Only when you tap Share or Export on a report, so you can send it on yourself. |

## Where the information is kept

On servers we run for SmartShala, in India. Each school's records sit in its own
database. Connections between the app and the server use HTTPS. A document you attach to a leave request is
stored on the application server and is readable only by you and your
school's principal or administrator.

On your phone, the apps keep your sign-in token and your school code in the device's own secure store — the
Android keystore (encrypted shared preferences) or the iOS keychain — never in plain storage. Signing out
deletes the tokens. On iOS the keychain outlives an uninstall, so reinstalling the app can restore a session
that was never signed out of; sign out before handing a phone to someone else.

## Who else sees it

- **People at your school**, according to their role. A teacher sees their own classes, their own punch and
  leave records and their own salary slips; a principal or administrator sees the whole school.
- **Service providers we need to run SmartShala** — our hosting provider, and the payment gateway (Razorpay)
  when a school pays for its subscription. They receive only what that job needs.
- **Nobody else**, unless the law requires it or your school asks us to.

## How long it is kept, and how to have it deleted

School records are kept while your school uses SmartShala and for 30 days after it stops,
unless the school asks us to delete them sooner.

**Punch selfies are deleted after 7 days**, automatically, whatever else is kept. They exist so a principal
can check a punch soon after it happens, not to build a record of anyone's face.

Because your school creates and owns the accounts, **ask your school's principal or administrator** to
correct or delete your account and the records attached to it. They can do it from the SmartShala dashboard.
If your school is no longer reachable, write to us at letssmartshala@gmail.com from the phone number or email on
your account and we will act on it within 30 days.

## Children

Student records are entered and controlled by the school as part of running the school. We do not knowingly
collect anything directly from a child: students do not have SmartShala accounts and the apps are not
directed to them.

## Security

Passwords are hashed. Traffic is encrypted in transit. Access is by role, checked on the server for every
request, and scoped to a single school. No system is perfectly safe, but if a breach affects your
information we will tell your school and, where the law requires it, the authorities.

## Changes

We will post any change on this page and move the effective date. A change that materially affects what we
collect will also be announced in the apps.

## Contact

Hybrid Monks LLP
letssmartshala@gmail.com · 9660877411
F1, Bhagwati Complex, Vejalpur, Ahmedabad, Gujarat, India

---

## Appendix — what to declare in Play Console's Data safety form and Apple's App Privacy

Not part of the published policy. This is the same list in the forms' own vocabulary, as the apps stand
today. Both apps collect the same things, and both stores get the same answers.

Apple's form asks one extra thing Google's does not: whether each type is **linked to the user's identity**.
Everything below is linked, because it all hangs off a named staff account. Apple also asks about
**tracking** — answer **no**, on both apps: nothing here is shared with a data broker or used for
cross-app advertising, so neither app needs the App Tracking Transparency prompt.

| Data type | Collected | Shared | Why | Optional? |
|---|---|---|---|---|
| Name | Yes | No | App functionality, account management | Required |
| Phone number | Yes | No | App functionality, account management | Required |
| User IDs | Yes | No | App functionality | Required |
| Other personal info (student and parent records staff enter) | Yes | No | App functionality | Required |
| Files and docs (a document attached to a leave request) | Yes | No | App functionality | **Optional** |
| Photos (the punch selfie, teacher app) | Yes | No | App functionality | **Optional** |
| App activity, crash logs, diagnostics | No | No | — | — |
| Location, contacts, financial info about the *user* | No | No | — | — |

Also declare: data is **encrypted in transit**; users **can request deletion** (through their school, or by
writing to us); the apps have an **account** and are **not directed to children**.

On the Photos row, answer "collected" and **not** "shared", and do not tick any processing purpose beyond
app functionality. The selfie is a photo of the user taken for attendance; it is not biometric data in the
Play policy sense because nothing measures or matches faces, but say plainly in the listing that teachers
photograph themselves when punching in, so a reviewer is never surprised by the camera opening.

**Before the first upload, re-check this list against the code** — it will stop being true the moment push
notifications add a device token, which is declared as "Device or other IDs".
