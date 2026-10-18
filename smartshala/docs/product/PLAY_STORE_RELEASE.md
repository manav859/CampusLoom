# Publishing the Teacher and Principal apps to Google Play

Two Play listings, one codebase. Each is a product flavor with its own application ID, name and icon:

| | Teacher | Principal |
|---|---|---|
| Application ID | `com.smartshala.teacher` | `com.smartshala.principal` |
| Store name | SmartShala Teacher | SmartShala Principal |
| Entrypoint | `lib/main_teacher.dart` | `lib/main_principal.dart` |
| Flavor | `teacher` | `principal` |

Both talk to `https://app.letssmartshala.com` in release builds. The `API_BASE_URL` override is compiled out
of release and profile builds on purpose, so a shipped app can only reach production.

---

## Where it stands

**Ready in the repo**

- Per-flavor launcher and adaptive icons, and a branded launch screen.
- A signing slot: drop in `android/key.properties` and release builds are signed with it.
- Target SDK 36, min SDK 24. Play currently requires 35 or higher for new apps, so this clears it.
- Both release bundles compile. Verified on 2026-10-18:
  `app-teacher-release.aab` (52.0 MB) and `app-principal-release.aab` (54.5 MB).
- `docs/product/PRIVACY_POLICY.md`, including an appendix that answers Play's Data safety form.

**Blocked on you**

| Needed | Why |
|---|---|
| An upload keystore | Without it both bundles are signed with the debug key, which Play rejects. |
| A Play Console account with both apps created | Nothing can be uploaded until the listings exist. |
| The privacy policy hosted at a public URL | Play requires a reachable URL, and the file still has `{{PLACEHOLDER}}` fields to fill. |
| Store text and screenshots | Per listing. See below. |

---

## 1. Create the upload keystore

Once, for both apps — the same key signs both.

```bash
keytool -genkey -v -keystore smartshala-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep the `.jks` and its passwords somewhere you will still have them in five years. **If you lose this key
you cannot update either app**, short of a Play key-reset request. Do not put it in the repository.

Then create `mobile/android/key.properties` (already in `.gitignore` territory — never commit it):

```properties
storeFile=D:/siteonlab/CampusLoom/smartshala-upload.jks
storePassword=<your store password>
keyAlias=upload
keyPassword=<your key password>
```

Use an **absolute path with forward slashes**. A relative `storeFile` resolves against
`mobile/android/app/`, which is four levels down and easy to get wrong; and in a `.properties` file a
backslash is an escape character, so `D:\siteonlab\...` silently reads as `D:siteonlab...`.

Verify it took effect — a signed build is the point, and the build falls back to the debug key without
complaint if the file is missing or misread.

## 2. Build the bundles

```bash
cd mobile
flutter build appbundle --flavor teacher   -t lib/main_teacher.dart   --release
flutter build appbundle --flavor principal -t lib/main_principal.dart --release
```

Output:

```
build/app/outputs/bundle/teacherRelease/app-teacher-release.aab
build/app/outputs/bundle/principalRelease/app-principal-release.aab
```

Bump `version:` in `mobile/pubspec.yaml` before every upload — it is `1.0.0+1` today. The number after `+`
is the versionCode, and Play refuses an upload that reuses one. Both flavors read the same line, so they
share a version; that is fine, they are separate listings.

**After the first manual upload, this is automated.** `tools/play-publish/` builds, bumps and uploads both
apps in one command:

```bash
cd tools/play-publish
node publish.mjs --flavor both --track internal --build --bump
```

See [`tools/play-publish/README.md`](../../tools/play-publish/README.md) for the service account setup it
needs. The API can only add releases to an app that already exists, so steps 1 and 3–5 below still happen
once, by hand.

## 3. Fill in the privacy policy and host it

`docs/product/PRIVACY_POLICY.md` has `{{PLACEHOLDER}}` fields: legal entity name, contact email and phone,
registered address, retention period, and the deletion-response window. Fill them, publish the result at a
stable public URL, and paste that URL into both listings.

It was updated on 2026-10-18 to cover the punch selfie. **Do not publish the older copy** — it stated the
apps never use the camera, which is no longer true.

## 4. Data safety form

The appendix at the bottom of the privacy policy is the same list in the form's vocabulary. The rows that
catch people out:

- **Photos — collected, not shared, app functionality, optional.** This is the punch selfie. Optional is
  correct: declining the camera still punches the teacher in.
- **Files and docs — optional.** Leave-request attachments.
- Declare encryption in transit, and that users can request deletion through their school.
- Answer "no" to advertising, analytics and tracking. Neither app carries an ad or analytics SDK.

Say in the Teacher listing description that teachers photograph themselves when punching in, so a reviewer
is not surprised when the camera opens. An unexplained camera is a common review hold.

## 5. Store listing assets — per app

- App icon, 512×512 PNG.
- Feature graphic, 1024×500.
- At least 2 phone screenshots, 16:9 or 9:16, min 320px on the short edge. 4–6 reads better.
- Short description, 80 characters. Full description, up to 4000.
- Category: Education. Content rating questionnaire: no objectionable content; both apps are tools for
  school staff and are **not** directed to children — answer that consistently with the policy.

Screenshots have to come off a device or emulator; there are none in the repo.

## 6. Before you hit publish

- [ ] `flutter test` and `flutter analyze` both clean in `mobile/`.
- [ ] Install each signed release bundle on a real phone and sign in. A release build cannot be redirected
      off production, so this exercises the live backend.
- [ ] Confirm the privacy policy URL loads publicly, in a private window.
- [ ] Re-read the Data safety appendix against the code. It goes stale the moment a feature touches new
      data — push notifications will add "Device or other IDs" when they land.
- [ ] Roll out to internal testing first, not straight to production.

---

## Still outstanding elsewhere

Push notifications (Firebase, `google-services.json`, a backend service account) are unrelated to listing
but will change the Data safety answers when they ship. The principal app's Notifications tile stays a
placeholder until then.
