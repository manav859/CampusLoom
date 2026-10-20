# Publishing the Teacher and Principal apps to the App Store

Two App Store listings, one codebase — the same split as
[PLAY_STORE_RELEASE.md](PLAY_STORE_RELEASE.md), on Apple's side:

| | Teacher | Principal |
|---|---|---|
| Bundle ID | `com.smartshala.teacher` | `com.smartshala.principal` |
| Store name | SmartShala Teacher | SmartShala Principal |
| Entrypoint | `lib/main_teacher.dart` | `lib/main_principal.dart` |
| Flavor / scheme | `teacher` | `principal` |

Written 2026-10-20, the day the iOS project was generated. Everything about how
the flavors are wired lives in [`mobile/README.md`](../../mobile/README.md); this
file is only about getting the two apps onto the store.

---

## Where it stands

The code is further along than the account is. Both flavors build clean for a
device, the icons and launch screen are branded, and `flutter analyze` and the
282 mobile tests pass. **Nothing has ever been signed, uploaded, or run on an
iPhone**, and five of the six things between here and a live listing are
account or paperwork, not code.

Apple team: **Hitesh Solanki, `759C76D23N`** — an *individual* enrolment. The
Apple Distribution certificate is on this Mac and valid to 2027-08-18. The only
provisioning profiles installed are ZopiQ's (`com.siteonlab.zopiqnow`).

> **The seller name on both listings will read "Hitesh Solanki", not Hybrid
> Monks LLP.** That is what an individual enrolment shows, and it will not match
> the GSTIN invoices the billing code issues. Switching later means an
> Organization enrolment (D-U-N-S number, Apple entity verification) *and*
> transferring both apps. Decide before the first submission, not after.

## 1. Register the apps — blocks everything below

Automatic signing currently fails at:

```
Communication with Apple failed: Your team has no devices from which to
generate a provisioning profile.
No profiles for 'com.smartshala.principal' were found.
```

Team `759C76D23N` has **no registered devices**, so Xcode cannot mint even the
development profile it insists on creating first. In
[developer.apple.com/account](https://developer.apple.com/account):

1. **Devices** → add one iPhone (its UDID). This alone clears the error above.
2. **Identifiers** → register `com.smartshala.principal` and
   `com.smartshala.teacher`. No capabilities are needed: the apps use no push,
   no sign-in-with-Apple, no iCloud, no app groups.
3. Sign the Apple ID into Xcode (Settings → Accounts) so automatic signing can
   create the App Store profiles on archive.

The project is already set up for this — `DEVELOPMENT_TEAM = 759C76D23N` and
`CODE_SIGN_STYLE = Automatic` on all six configurations. The Release
configurations also have Flutter's template `CODE_SIGN_IDENTITY = "iPhone
Developer"` removed; pinned, automatic signing can only ever resolve a
development profile and an archive for the store cannot succeed. That removal
has **not** been proven end to end, because the no-devices error fires first.

## 2. Build and upload

```bash
cd mobile
flutter build ipa --flavor principal -t lib/main_principal.dart --release
flutter build ipa --flavor teacher   -t lib/main_teacher.dart   --release
```

Then upload each `build/ios/ipa/*.ipa` with Transporter, or
`xcrun altool --upload-app`. An App Store Connect API key is worth creating
while you are in there — it is the only way this ever gets scripted the way
`tools/play-publish/publish.mjs` scripts Play.

`CFBundleShortVersionString` and `CFBundleVersion` come from `pubspec.yaml`
(`1.0.0+3`) exactly as on Android. Apple rejects a re-used build number, so the
`+N` has to rise on every upload.

## 3. Export compliance

Not yet declared. Both apps use HTTPS and nothing else, which is the standard
exemption, but the declaration is a legal statement and nobody has made it:
either answer the export question on each upload, or add
`ITSAppUsesNonExemptEncryption = false` to `ios/Runner/Info.plist` to stop being
asked. **Your call to make, not mine.**

## 4. Privacy policy — hard blocker

The App Store requires a reachable privacy policy URL before review, and
[PRIVACY_POLICY.md](PRIVACY_POLICY.md) still has ten unfilled placeholders:
legal entity name, registered address, contact email, contact phone, hosting
location, retention period, deletion-response days, effective date, and two
inline choices. There is also no `/privacy` route in `frontend/` yet — the file
is not published anywhere.

Give me those ten and I can publish it at
`https://app.letssmartshala.com/privacy` the same day. This is the same item as
D1 in [ANDROID_GO_LIVE.md](ANDROID_GO_LIVE.md), still open.

## 5. App Privacy and age rating — per app

The appendix at the bottom of the privacy policy is the same list in Apple's
words. The rows people get wrong:

- **Photos** — collected, linked to the user, app functionality. The punch
  selfie. Say so in the Teacher description too, or a reviewer holds the app
  over an unexplained camera prompt.
- **Contact info / identifiers** — collected, linked, app functionality.
- **No tracking.** Nothing in either app talks to an ad network or an analytics
  SDK, so the App Tracking Transparency prompt is not needed.

Age rating: Education, no objectionable content, **not** made for kids — these
are staff tools. Answer identically in both listings.

## 6. Two review risks worth knowing now

**Demo account (Guideline 2.1).** Both apps are login-only with no signup, so
review *will* be blocked without working credentials. Give them a real
production school code, a principal login for one app and a teacher login for
the other, and say in the review notes that the two binaries take different
roles — a reviewer who tries the teacher login on the principal app gets a
rejection screen and files it as a bug.

**Account deletion (Guideline 5.1.1(v)).** There is no in-app account deletion
anywhere in the codebase, web or mobile. The usual exemption is that users
cannot create their own accounts — schools provision them — and that is true
here. Expect to have to argue it in review notes; a rejection on this is the
single most likely one.

Not a blocker, but adjacent: the apps keep subscription billing out entirely
(renewals happen on the web, same reasoning as Play Billing). For B2B software a
school buys on invoice, that is allowed; it would not be if the app ever sold a
subscription to the person holding the phone.

## 7. Listing assets — per app

Screenshots are live on both listings as of 2026-10-21: four 6.9" iPhone shots
each, plus four (Principal) and three (Teacher) 13" iPad shots. **The iPad set
is not optional** — the binaries are universal, so review refuses the version
with `SCREENSHOT_REQUIRED.IPAD_13_PROFILE` until a 2064x2752 set exists; capture
it on the **iPad Pro 13-inch (M5)** simulator and upload it as
`APP_IPAD_PRO_3GEN_129`. The iPhone shots were captured on
the **iPhone 17 Pro Max** simulator — it renders exactly 1320x2868, while the
iPhone 17 Pro gives 1206x2622 and Apple rejects it. Upload them with
`node tools/appstore-publish/screenshots.mjs <localizationId> <image.png...>`,
which reserves, PUTs and commits each image; `asc.mjs` cannot, because the bytes
go to a signed URL on another host. **The 6.9" slot is called `APP_IPHONE_67` in
the API — there is no `APP_IPHONE_69`** — and an image with an alpha channel is
refused, so flatten the simctl PNGs to RGB first. Everything else (short
description, full description, keywords, support URL) can be adapted from the
Play listings.

Driving the simulator to reach each screen needs three things right, and each
one fails silently on its own:

- Accessibility must be granted to the terminal **before it starts**; a grant
  made mid-process lets AppleScript keep reading window geometry while every
  synthetic click and keystroke is dropped.
- Set Window -> Point Accurate first. The window is otherwise scaled (~91.6%),
  so screen points are not device points; read the device rect off the window's
  AXGroup and map `screen = origin + pixel / 3`.
- Click instantly (`cliclick c:x,y`). A held press — even 120ms — loses the tap
  to the scroll gesture arena anywhere inside a Flutter scrollable, which looks
  exactly like a missed coordinate.
- **Re-read the window rect before every tap.** The Simulator window moves on
  its own; a cached origin silently misses everything after it shifts.
- Paste credentials through `simctl pbcopy` + Cmd-V. Typing them lets iOS
  autocapitalise the first letter of an email address.

## 8. Submission preflight

Adding the version to a review submission is the only honest check — it returns
every blocker at once:

```bash
node asc.mjs POST /v1/reviewSubmissions '{"data":{"type":"reviewSubmissions","attributes":{"platform":"IOS"},"relationships":{"app":{"data":{"type":"apps","id":"<appId>"}}}}}'
node asc.mjs POST /v1/reviewSubmissionItems '{"data":{"type":"reviewSubmissionItems","relationships":{"reviewSubmission":{"data":{"type":"reviewSubmissions","id":"<subId>"}},"appStoreVersion":{"data":{"type":"appStoreVersions","id":"<versionId>"}}}}}'
```

Six things blocked the first run; five are settable over the API and are now
done on both apps: `copyright` on the version, `usesNonExemptEncryption` on the
*build* (the `Info.plist` key does not backfill a build already uploaded),
`primaryCategory` on the appInfo, a free `appPriceSchedule`, and the iPad
screenshots. **`contentRightsDeclaration` is a declaration, not a formality** —
it is set to `DOES_NOT_USE_THIRD_PARTY_CONTENT`.

The sixth, **App Privacy (`appDataUsages`), has no API at all** — every path
404s. It has to be filled in the App Store Connect web UI, App Privacy ->
Get Started, using the appendix table in [PRIVACY_POLICY.md](PRIVACY_POLICY.md),
and then **published**. Until it is, both versions fail with
`STATE_ERROR.APP_DATA_USAGES_REQUIRED`.

Icons are generated: `mobile/ios/Runner/Assets.xcassets/AppIcon-<flavor>.appiconset`,
all 15 sizes, alpha flattened by `actool` on build so the no-transparency rule is
satisfied.

## Still outstanding elsewhere

- **No device run, ever.** No iPhone has launched either app. Do a TestFlight
  internal build and walk attendance, fees and punch before submitting — the
  punch selfie in particular has never been exercised against iOS's camera
  permission flow.
- **No crash reporting**, same gap as Android — see section B of
  [ANDROID_GO_LIVE.md](ANDROID_GO_LIVE.md).
- **Production still runs with the billing worker and Razorpay off.** Fine for a
  pilot, not for paid schools, on either platform.
