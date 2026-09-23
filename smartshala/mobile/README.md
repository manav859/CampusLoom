# SmartShala Mobile (V2)

Flutter apps for the SmartShala V2 blueprint: one codebase, two Android
binaries built from separate entrypoints and Gradle flavors.

| App | Entrypoint | Flavor | Application ID |
|---|---|---|---|
| Principal | `lib/main_principal.dart` | `principal` | `com.smartshala.principal` |
| Teacher | `lib/main_teacher.dart` | `teacher` | `com.smartshala.teacher` |

## Run

```bash
flutter pub get

# Teacher app — talks to the deployed backend, no local server needed
flutter run --flavor teacher -t lib/main_teacher.dart

# Principal app
flutter run --flavor principal -t lib/main_principal.dart
```

## Backend

`API_BASE_URL` defaults to `https://smartshala-backend.onrender.com` — the same
deployed API the web dashboard uses. Nothing has to be running locally, on an
emulator or on a real phone.

Point at a local backend only when you are changing the API itself:

```bash
# Android emulator: 10.0.2.2 is the host machine
flutter run --flavor teacher -t lib/main_teacher.dart \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000

# Physical device on the same Wi-Fi: use the host's LAN IP
flutter run --flavor teacher -t lib/main_teacher.dart \
  --dart-define=API_BASE_URL=http://192.168.1.x:4000
```

Any override shows a "Custom backend" badge on the login screen, so a local
build is never mistaken for the real one. Debug builds allow cleartext HTTP for
these local URLs; release builds are HTTPS-only, which the deployed default is.

The hosted instance sleeps when idle, so the first request after a quiet spell
can take tens of seconds — the client's receive timeout is set to outlast it.

The base URL is a single constant, `AppConfig.productionBaseUrl` in
[`lib/core/config/app_config.dart`](lib/core/config/app_config.dart); change it
there when the API moves.

## Signing in

The backend is multi-tenant and routes are `/{schoolCode}/api/v1/...`, so the
login screen asks for a **school code** (e.g. `SS000001`) alongside the
email/phone and password. The code is remembered between sessions; tokens live
in the device keystore.

Each binary accepts only its own roles — `PRINCIPAL`/`ADMIN` for the principal
app, `TEACHER` for the teacher app — and says so plainly if you sign in to the
wrong one.

The form validates before it calls the API: the school code must be eight
letters/digits (what the server's `isValidSchoolId` accepts), the identifier
must be an email or a ten-digit phone, and the password 6–72 characters.

Note that a locally-run backend is usually a *different* tenant. `SS000001` is
valid on the deployed API; a local backend without `MASTER_DATABASE_URL` falls
back to legacy mode and derives its code from the school row instead.

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
`android/app/src/<flavor>/res`, plus a 512px store icon into `store/<flavor>/`:

```bash
flutter test tool/generate_brand_assets.dart
```

Re-run it after changing a brand colour in `lib/core/theme/app_colors.dart`, and
commit what it writes. `test/launcher_icons_test.dart` fails if a density goes
missing or the glyph grows past the adaptive icon's safe zone.

## Release builds

```bash
flutter build apk --flavor principal -t lib/main_principal.dart --release
flutter build appbundle --flavor teacher -t lib/main_teacher.dart --release
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
