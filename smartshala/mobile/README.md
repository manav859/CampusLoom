# SmartShala Mobile (V2)

Flutter apps for the SmartShala V2 blueprint: one codebase, two binaries per
platform, built from separate entrypoints and flavors.

| App | Entrypoint | Flavor | Application ID / Bundle ID |
|---|---|---|---|
| Principal | `lib/main_principal.dart` | `principal` | `com.smartshala.principal` |
| Teacher | `lib/main_teacher.dart` | `teacher` | `com.smartshala.teacher` |

Android and iOS use the same two IDs. Android is on Play internal testing; the
iOS builds are uploaded to App Store Connect and not yet submitted for review.

## Run

```bash
flutter pub get

# Teacher app — talks to the deployed backend, no local server needed
flutter run --flavor teacher -t lib/main_teacher.dart

# Principal app
flutter run --flavor principal -t lib/main_principal.dart
```

The flavor is not optional on either platform: Gradle has no flavorless variant
and the Xcode project has no scheme but `principal` and `teacher`, so there is
no way to build a nameless third app by forgetting the flag.

## Backend

`API_BASE_URL` defaults to `https://app.letssmartshala.com` — the production
VPS, the same origin the web dashboard is served from. Nothing has to be
running locally, on an emulator or on a real phone.

Point at a local backend only when you are changing the API itself:

```bash
# Android emulator: 10.0.2.2 is the host machine
flutter run --flavor teacher -t lib/main_teacher.dart \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000

# iOS simulator: it shares the host's network, so localhost is the host
flutter run --flavor teacher -t lib/main_teacher.dart \
  --dart-define=API_BASE_URL=http://localhost:4000

# Physical device on the same Wi-Fi: use the host's LAN IP
flutter run --flavor teacher -t lib/main_teacher.dart \
  --dart-define=API_BASE_URL=http://192.168.1.x:4000
```

The override is honoured in debug builds only. A release or profile build
ignores it and talks to the VPS whatever is passed, so a shipped APK cannot be
aimed anywhere else; in release the override is not even compiled in. Any
override that does apply shows a "Custom backend" badge on the login screen, so
a local build is never mistaken for the real one. Android debug builds allow
cleartext HTTP for these local URLs; release builds are HTTPS-only, which the
VPS is. iOS carries `NSAllowsLocalNetworking` in every build, which relaxes App
Transport Security for loopback and the local network *only* — cleartext to a
public host stays blocked, and a release build cannot be aimed off the VPS in
the first place.

The base URL is a single constant, `AppConfig.productionBaseUrl` in
[`lib/core/config/app_config.dart`](lib/core/config/app_config.dart); change it
there when the API moves.

## Signing in

The backend is multi-tenant and routes are `/{schoolCode}/api/v1/...`, but the
login screen asks only for an **email or phone** and a password, the same as
the web dashboard. `/auth/login` is not tenant-scoped: the server searches the
active tenants for the identifier and returns the school as `tenantSchoolId`,
which the app stores in the device keystore and puts in every later URL. Tokens
live there too.

Each binary accepts only its own roles — `PRINCIPAL`/`ADMIN` for the principal
app, `TEACHER` for the teacher app — and says so plainly if you sign in to the
wrong one.

The form validates before it calls the API: the identifier must be an email or
a ten-digit phone, and the password 6–72 characters.

One consequence of resolving the tenant server-side: the same email in two
schools is ambiguous, and the server returns whichever tenant answers first.

## Layout

```
lib/
  core/            shared by both apps
    api/           dio client, tenant-scoped URLs, refresh-on-401
    auth/          token storage, repository, AuthController
    config/        flavor + base URL
    theme/         colors, typography, component theme
    widgets/       cards, stat tiles, brand header, state views
  features/
    auth/          login
    principal/     shell, More, Quick Add
    teacher/       shell, home, attendance, Swipe To Punch
```

## Tests

```bash
flutter test
```

`test/swipe_to_punch_test.dart` pins the blueprint rule that punching is a
swipe and never a tap. `test/app_config_test.dart` pins the deployed backend as
the default, so a build can never quietly fall back to localhost.

## Brand assets

The launcher icon, the adaptive icon and the launch-screen mark are drawn by
[`tool/generate_brand_assets.dart`](tool/generate_brand_assets.dart) — the same
rounded square with an ExtraBold white `Ss` that tops every screen, in the
portal's colour (blue for the principal, teal for the teacher, so the two apps
are told apart on a home screen that holds both). It writes every density into
`android/app/src/<flavor>/res`, every iOS size into
`ios/Runner/Assets.xcassets/AppIcon-<flavor>.appiconset`, the iOS launch mark
into `LaunchImage.imageset` (shared — both flavors wear the same mark), plus a
512px store icon into `store/<flavor>/`:

```bash
flutter test tool/generate_brand_assets.dart
```

Re-run it after changing a brand colour in `lib/core/theme/app_colors.dart`, and
commit what it writes. `test/launcher_icons_test.dart` fails if a density or an
iOS size goes missing, if the glyph grows past the adaptive icon's safe zone, or
if the iOS icon picks up a transparent corner — Apple rounds and masks app icons
itself and rejects one that arrives pre-rounded.

Re-running the tool on a newer Flutter rewrites the Android PNGs with a byte or
two of anti-aliasing difference and no visible change. That churn is noise; drop
it from the commit unless the mark itself moved.

## How the iOS flavors are wired

Android gets its two apps from `productFlavors` in
[`android/app/build.gradle.kts`](android/app/build.gradle.kts). Xcode has no
such thing, so Flutter's `--flavor` maps onto a **scheme** of that name and a
**build configuration** called `<Mode>-<flavor>`. The project therefore has:

- schemes `principal` and `teacher`, and no `Runner` scheme — which is what
  makes the flag mandatory;
- six configurations, `Debug/Profile/Release` × the two flavors, each one
  backed by `ios/Flutter/<Mode>-<flavor>.xcconfig`;
- one small file per flavor, [`ios/Flutter/principal.xcconfig`](ios/Flutter/principal.xcconfig)
  and [`ios/Flutter/teacher.xcconfig`](ios/Flutter/teacher.xcconfig), holding
  the bundle ID, the two names and the icon set.

Everything that differs between the apps lives in those two files, so the
Runner target's settings are identical across all six configurations and
`project.pbxproj` holds no flavor literal at all. `Info.plist` reads the names
through `$(FLAVOR_DISPLAY_NAME)` and `$(FLAVOR_BUNDLE_NAME)`.

Adding a flavor means: a `<flavor>.xcconfig`, three `<Mode>-<flavor>.xcconfig`
files, three build configurations, a scheme, an entry in the `project 'Runner'`
map in [`ios/Podfile`](ios/Podfile) — CocoaPods cannot guess the build type
from a name it does not know — and a `_flavors` entry in the brand tool.

## Release builds

```bash
flutter build apk --flavor principal -t lib/main_principal.dart --release
flutter build appbundle --flavor teacher -t lib/main_teacher.dart --release

# iOS — unsigned; see the signing note below for why that is still the only way
flutter build ios --flavor teacher -t lib/main_teacher.dart --release --no-codesign
```

Without a keystore these are signed with the **debug** key: fine for installing
on a phone, rejected by the Play Store. To sign for real, create the upload
keystore once —

```bash
keytool -genkey -v -keystore <somewhere safe>/smartshala-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

— and write `android/key.properties` beside it:

```properties
storeFile=<absolute path to smartshala-upload.jks>
storePassword=...
keyAlias=upload
keyPassword=...
```

Both files are gitignored on purpose. **Back up the keystore somewhere you will
still have it in five years**: Play ties the published apps to it, and losing it
means never updating them again. The Gradle config picks it up on its own when
the file exists and falls back to debug signing when it does not, so a build
never breaks for want of it.

iOS signs against team `759C76D23N` (`DEVELOPMENT_TEAM`, automatic signing on
all six configurations), but no archive has ever succeeded: the team has no
registered devices, so Xcode cannot create a provisioning profile and
`--no-codesign` is still the only way an iOS build completes. The steps out of
that, and everything else between here and a live listing, are in
[`docs/product/APP_STORE_RELEASE.md`](../docs/product/APP_STORE_RELEASE.md).
