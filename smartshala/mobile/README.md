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
