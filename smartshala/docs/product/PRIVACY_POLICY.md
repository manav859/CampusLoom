# SmartShala mobile apps — privacy policy (draft)

**Status: a draft for the owner to complete and host.** Google Play will not publish either app without a
privacy policy at a public URL, and the URL must be reachable without signing in. Everything in `{{ }}` is a
fact only the owner has; fill those in, host the page (a plain page on the SmartShala marketing site is
enough), and put its URL in both Play Console listings.

Everything else below describes what the apps and the backend in this repository actually do as of
2026-09-23. If the apps change what they collect — push notifications will add a device token — change this
page in the same commit.

---

**Effective date:** {{DD Month YYYY}}
**Applies to:** SmartShala Principal (`com.smartshala.principal`) and SmartShala Teacher
(`com.smartshala.teacher`) for Android, and the SmartShala web dashboard they share.
**Published by:** {{LEGAL ENTITY NAME}}, {{REGISTERED ADDRESS}} ("we", "us").

## Who uses these apps

Both apps are for **school staff**: a principal or administrator, and teachers. Accounts are not open to the
public — a school creates them, and you sign in with the school code, your phone number and a password given
to you by your school. There are no student or parent accounts in these apps.

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

**Technical information needed to run the service.** Your sign-in tokens, the app version, and the server
logs any internet service keeps (request times, error traces, and the IP address your phone connects from).

## What the apps do not collect

- **No location.** Punch in and punch out record the time only. There is no geofencing and the apps never ask
  for a location permission.
- **No contacts, photos, microphone or camera.** The only file that leaves your phone is a document you pick
  yourself to attach to a leave request.
- **No advertising, and no advertising identifier.** The apps carry no ad SDK and no third-party analytics or
  tracking SDK.
- **No selling of personal information, to anyone, ever.**

## Permissions, and what each one is for

| Permission / capability | Why |
|---|---|
| Internet access | Everything in the apps comes from your school's SmartShala server. |
| File picker (no storage permission) | Only when you tap Attach on a leave request. Android's own picker hands us the one file you choose; the apps cannot browse your storage. |
| Opening the dialer or WhatsApp | Only when you tap a phone number on a student, teacher or transport screen. It hands the number to the app you choose and we learn nothing about the call. |
| The Android share sheet | Only when you tap Share or Export on a report, so you can send it on yourself. |

## Where the information is kept

On servers we run for SmartShala, {{HOSTING LOCATION, e.g. "in India"}}. Each school's records sit in its own
database. Connections between the app and the server use HTTPS. A document you attach to a leave request is
stored {{"in our object storage" / "on the application server"}} and is readable only by you and your
school's principal or administrator.

On your phone, the apps keep your sign-in token and your school code in the Android keystore
(encrypted shared preferences), never in plain storage. Signing out deletes the tokens; the school code stays
so the next sign-in screen can fill it in for you.

## Who else sees it

- **People at your school**, according to their role. A teacher sees their own classes, their own punch and
  leave records and their own salary slips; a principal or administrator sees the whole school.
- **Service providers we need to run SmartShala** — our hosting provider, and the payment gateway (Razorpay)
  when a school pays for its subscription. They receive only what that job needs.
- **Nobody else**, unless the law requires it or your school asks us to.

## How long it is kept, and how to have it deleted

School records are kept while your school uses SmartShala and for {{RETENTION PERIOD}} after it stops,
unless the school asks us to delete them sooner.

Because your school creates and owns the accounts, **ask your school's principal or administrator** to
correct or delete your account and the records attached to it. They can do it from the SmartShala dashboard.
If your school is no longer reachable, write to us at {{CONTACT EMAIL}} from the phone number or email on
your account and we will act on it within {{N}} days.

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

{{LEGAL ENTITY NAME}}
{{CONTACT EMAIL}} · {{CONTACT PHONE}}
{{REGISTERED ADDRESS}}

---

## Appendix — what to declare in Play Console's Data safety form

Not part of the published policy. This is the same list in the form's own vocabulary, as the apps stand
today. Both apps collect the same things.

| Data type | Collected | Shared | Why | Optional? |
|---|---|---|---|---|
| Name | Yes | No | App functionality, account management | Required |
| Phone number | Yes | No | App functionality, account management | Required |
| User IDs | Yes | No | App functionality | Required |
| Other personal info (student and parent records staff enter) | Yes | No | App functionality | Required |
| Files and docs (a document attached to a leave request) | Yes | No | App functionality | **Optional** |
| App activity, crash logs, diagnostics | No | No | — | — |
| Location, contacts, photos, financial info about the *user* | No | No | — | — |

Also declare: data is **encrypted in transit**; users **can request deletion** (through their school, or by
writing to us); the apps have an **account** and are **not directed to children**.

**Before the first upload, re-check this list against the code** — it will stop being true the moment push
notifications add a device token, which is declared as "Device or other IDs".
