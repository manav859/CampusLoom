# Pushing builds to Google Play

Uploads `app-teacher-release.aab` and `app-principal-release.aab` to Play and puts them on a track,
so a release is one command instead of two console uploads.

```bash
cd tools/play-publish
npm install            # once
```

## Usage

```bash
# the usual: bump the version, build both apps, push to internal testing
PLAY_SERVICE_ACCOUNT_JSON=/path/to/key.json \
  node publish.mjs --flavor both --track internal --build --bump

# one app only, already built
node publish.mjs --flavor teacher --track internal

# with notes for testers
node publish.mjs --flavor both --track internal --build --bump --notes "Punch selfies."

# production, left as a draft to review in the console
node publish.mjs --flavor both --track production --status draft --build --bump
```

| Flag | Meaning |
|---|---|
| `--flavor` | `teacher`, `principal` or `both` (default `both`) |
| `--track` | `internal`, `alpha`, `beta`, `production` (default `internal`) |
| `--status` | `completed` or `draft` (default `completed`) |
| `--build` | Build the bundles first |
| `--bump` | Raise the versionCode in `mobile/pubspec.yaml` before building |
| `--notes` | Release notes shown to testers |

Both flavors share the `version:` line in `mobile/pubspec.yaml`, so `--bump` raises it once for the run.
Play rejects a versionCode it has already seen, so bump on every upload.

## What it cannot do

- **Create a listing.** The app must already exist in Play Console, with at least one bundle uploaded
  by hand. The API only adds releases to an app that exists.
- **Fill in store text, screenshots, data safety or content rating.** Those are console work, once.
- **Skip review.** Internal testing goes live in minutes; other tracks wait on Google.

## One-time setup

1. **Google Cloud project** — at <https://console.cloud.google.com>, create (or pick) a project and
   enable the **Google Play Android Developer API**.
2. **Service account** — IAM & Admin → Service Accounts → Create. No project roles needed; its power
   comes from the Play invitation in step 4. Then Keys → Add key → JSON, and save the file somewhere
   outside the repository.
3. **Link the project** — Play Console → Settings → API access → link the Cloud project.
4. **Invite the service account** — Play Console → Users and permissions → Invite user, using the
   service account's email. Grant, for both apps: *Release to testing tracks*, plus *Release to
   production* only if you want this script to touch production. Accept the invitation.
5. **Point the script at the key**:

   ```bash
   export PLAY_SERVICE_ACCOUNT_JSON=/path/to/key.json     # bash
   $env:PLAY_SERVICE_ACCOUNT_JSON = "C:\path\to\key.json" # PowerShell
   ```

The key file and `node_modules/` here are gitignored. Treat the key like the keystore: anyone holding
it can ship an update to your users.

## When it fails

| Message | Cause |
|---|---|
| `Play has no app with package name …` | Listing not created yet, or no manual first upload. |
| `Play refused the service account (403)` | Invitation not sent, not accepted, or missing the track permission. |
| `versionCode … has already been used` | Bump `mobile/pubspec.yaml` (`--bump`). |
| `No bundle at …` | Build first, or pass `--build`. |

See also [`docs/product/PLAY_STORE_RELEASE.md`](../../docs/product/PLAY_STORE_RELEASE.md) for the
listing itself — keystore, store assets, privacy policy and the data safety form.
