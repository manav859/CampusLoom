# Push notifications

What is built, what it sends, and the five things only the owner can supply to
turn it on. Until those exist the apps behave exactly as they did before: no
permission prompt, no token, nothing sent, nothing to crash.

This is item 32 of [APP_V2_IMPLEMENTATION_PLAN.md](APP_V2_IMPLEMENTATION_PLAN.md).

---

## 1. What a user actually gets

| Event | Who is notified | Opens |
|---|---|---|
| A notice is published | the audience it was addressed to — `TEACHERS` wakes teachers, `ALL`/`STAFF` wakes everyone with an account. `PARENTS` notices wake nobody: those go out over WhatsApp | Messages |
| A teacher applies for leave | every Principal and Admin except the applicant | Leave Approval |
| Leave is approved or rejected | the teacher who applied | Messages |
| Marks are recorded for a class | Principals and Admins, plus the class teacher when someone else entered them | Home |
| A calendar event is added | all staff except whoever added it | Calendar |
| A holiday is declared | all staff except whoever declared it | Calendar |
| **Daily:** a class still has no attendance | that class's class teacher, once, listing their unmarked classes | Home |
| **Daily:** leave requests are still pending | every Principal and Admin | Leave Approval |

The author of an action is never notified about it. The two daily reminders run
in one pass at `PUSH_REMINDER_HOUR` (default 12) on the server clock — the same
clock every other date in this codebase is read on — and are skipped on Sundays
and declared holidays, which are not school days.

**Not sent, on purpose:** anything to parents (they are reached over WhatsApp,
not an app), and anything from Payroll or Transport, which are
[hidden modules](APP_V2_IMPLEMENTATION_PLAN.md) whose routes 404.

---

## 2. What the owner has to supply

### a. A Firebase project with four apps

One project, four apps — two Android, two iOS:

| | Android package | iOS bundle |
|---|---|---|
| Principal | `com.smartshala.principal` | `com.smartshala.principal` |
| Teacher | `com.smartshala.teacher` | `com.smartshala.teacher` |

Create it at <https://console.firebase.google.com>. **Do not reuse
`zopiq-de276`** — a shared project means one leaked service account reaches both
products' users.

For the Android apps, add the signing certificate SHA-1 of the upload keystore
(`~/smartshala-app-safe/smartshala-upload.jks`, alias `upload`) and of Play App
Signing, or Firebase will refuse the API key on a Play-installed build:

```
keytool -list -v -keystore ~/smartshala-app-safe/smartshala-upload.jks -alias upload
```

### b. Eight values into `mobile/lib/core/push/push_config.dart`

No `google-services.json` and no `GoogleService-Info.plist` are used. This
repository builds four applications from one target, and a native config file
per flavor would need a Gradle copy step and an Xcode build phase; the same
values passed as `FirebaseOptions` from Dart, where the flavor is already known,
replace both. They are not secrets — they ship inside every APK and IPA.

| Constant | Firebase console → Project settings → General |
|---|---|
| `projectId` | "Project ID" |
| `messagingSenderId` | "Project number" |
| `androidApiKey` | either Android app → `google-services.json` → `api_key[0].current_key` |
| `iosApiKey` | either iOS app → `GoogleService-Info.plist` → `API_KEY` |
| `principalAndroidAppId` | the Principal Android app's "App ID" |
| `teacherAndroidAppId` | the Teacher Android app's "App ID" |
| `principalIosAppId` | the Principal iOS app's "App ID" |
| `teacherIosAppId` | the Teacher iOS app's "App ID" |

An App ID looks like `1:123456789012:android:0a1b2c3d4e5f6789`.

### c. An APNs key, for iOS only

Apple Developer → Certificates, Identifiers & Profiles → Keys → **+**, tick
**Apple Push Notifications service (APNs)**, download the `.p8` (**once only**).
Upload it in Firebase → Project settings → Cloud Messaging → *Apple app
configuration*, for **both** iOS apps, with the Key ID and the Team ID
`759C76D23N`.

This is a different key from the App Store Connect API key `F5ZA3HP979` in
[APP_STORE_RELEASE.md](APP_STORE_RELEASE.md). One key covers both apps.

### d. The Push Notifications capability on both App IDs

Apple Developer → Identifiers → `com.smartshala.principal`, tick **Push
Notifications**, save; then the same for `com.smartshala.teacher`.

**Until this is done, `flutter build ipa` fails** with *"provisioning profile
does not include the aps-environment entitlement"*, because
`ios/Runner/Runner.entitlements` now asks for it. Automatic signing usually adds
the capability itself when the account owns the App ID; do it by hand if it does
not. Android is unaffected.

### e. A service account for the backend

Firebase → Project settings → Service accounts → **Generate new private key**.
Put the JSON on the VPS *outside* the repository and point the API at it:

```
# /srv/smartshala-env/api.env
FCM_SERVICE_ACCOUNT=/srv/smartshala-secrets/fcm-service-account.json
PUSH_REMINDER_HOUR=12          # optional, defaults to 12
BACKGROUND_WORKERS_ENABLED=1   # required for the two daily reminders only
```

`chmod 600` it. The variable also accepts the JSON inline for hosts that have
nothing but environment variables. Then redeploy —
see [VPS_PRODUCTION_RUNBOOK](../../deploy/deploy.sh) for the deploy command.

---

## 3. The migration

`device_registrations` is a new table in the **tenant** schema, so it has to
reach every school database, not just the main one:

```
cd backend
npm run tenant:migrate-all
```

Nothing is pushed to a school that has not been migrated: the send path asks for
registrations first and finds none. Check [the P3009 note](APP_V2_IMPLEMENTATION_PLAN.md)
before running migrations against production.

---

## 4. How it works

**Addressing.** FCM has deprecated the registration token in favour of the
**Firebase Installation ID**, and the HTTP v1 send API takes it as `message.fid`
(mutually exclusive with the old `token`). The apps call
`FirebaseMessaging.register()` and send whatever arrives on `onRegistered` to
`POST /push/devices`; the server stores one row per install. A FID is unique
across devices, so signing in on a phone someone else used **moves** the row to
the new user rather than adding one — the previous user stops receiving that
device's notifications immediately.

**Pruning.** An uninstalled app never says so. A send that comes back 404
`UNREGISTERED` or 400 `INVALID_ARGUMENT` deletes the row. A 403
`SENDER_ID_MISMATCH` deliberately does **not**: that means our own credentials
are wrong, and pruning on it would wipe every registration in the school on the
first misconfigured deploy.

**Nothing blocks a request.** Every trigger is one call into
`push.events.ts`, which returns immediately and does the lookup and the delivery
after the response has gone out. A push that fails is logged and dropped; it
never fails the action that caused it.

**Foreground.** iOS draws its own banner over the open app. Android draws
nothing, so `PushMessenger` shows an in-app SnackBar instead. No local
notifications plugin is used for this.

**Android channel.** `smartshala_default`, created in `MainActivity.kt`, named
in `AndroidManifest.xml` and sent by the backend in `fcm.ts` — all three have to
agree or Android posts through a silent "Miscellaneous" channel. The status-bar
icon is `ic_notification`, a white silhouette generated by
`tool/generate_brand_assets.dart`; without it Android silhouettes the launcher
icon into a white blob.

### Where the code is

| | |
|---|---|
| `backend/src/modules/push/fcm.ts` | HTTP v1 transport — service-account JWT, access token cache, one POST per install. No `firebase-admin`. |
| `backend/src/modules/push/push.messages.ts` | Every title, body and target. Pure; covered by `npm run test:push`. |
| `backend/src/modules/push/push.events.ts` | One function per event, called from the feature services. |
| `backend/src/modules/push/push.worker.ts` | The daily reminder pass, across every tenant. |
| `mobile/lib/core/push/push_config.dart` | **The file to fill in.** |
| `mobile/lib/core/push/push_service.dart` | Lifecycle, registration, routing. Covered by `test/push_test.dart`. |

---

## 5. Checking it works

1. Fill in `push_config.dart`, deploy the backend with `FCM_SERVICE_ACCOUNT`,
   run `npm run tenant:migrate-all`.
2. Install the app, sign in, accept the permission prompt.
3. `SELECT * FROM device_registrations;` in that school's database — one row.
4. Publish an announcement to Teachers from the web dashboard. Every signed-in
   teacher's phone should buzz; tapping opens Messages.
5. Background the app and repeat — the notification should appear in the shade
   with the SmartShala mark, not a white square.

If nothing arrives, the API log is the place to look: every send writes an
`evt: "push.sent"` line with how many went out and how many registrations were
pruned.

---

## 6. Privacy declarations this adds

Push adds a device identifier to what the apps handle, which both stores ask
about. See the appendix in [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

- **Play Console → Data safety:** add **Device or other IDs**, collected, not
  shared, purpose *App functionality*.
- **App Store Connect → App Privacy:** add **Device ID**, purpose *App
  Functionality*, linked to the user **Yes**, tracking **No**, on both apps.
  This page is web-UI only and cannot be scripted, and it must be
  **Published** — see [APP_STORE_RELEASE.md](APP_STORE_RELEASE.md).
