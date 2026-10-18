#!/usr/bin/env node
// Uploads a built app bundle to Google Play and puts it on a track.
//
//   node publish.mjs --flavor both --track internal --build --bump
//
// Needs PLAY_SERVICE_ACCOUNT_JSON pointing at the service account key, and the
// app already created in Play Console with one bundle uploaded by hand — the
// API cannot create a listing, only add releases to one that exists.
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const mobile = join(repo, "mobile");
const pubspec = join(mobile, "pubspec.yaml");

const FLAVORS = {
  teacher: { packageName: "com.smartshala.teacher", entrypoint: "lib/main_teacher.dart" },
  principal: { packageName: "com.smartshala.principal", entrypoint: "lib/main_principal.dart" }
};

const TRACKS = ["internal", "alpha", "beta", "production"];

function parseArgs(argv) {
  const args = { flavor: "both", track: "internal", status: "completed", build: false, bump: false, notes: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      return value;
    };
    if (arg === "--flavor") args.flavor = next();
    else if (arg === "--track") args.track = next();
    else if (arg === "--status") args.status = next();
    else if (arg === "--notes") args.notes = next();
    else if (arg === "--build") args.build = true;
    else if (arg === "--bump") args.bump = true;
    else if (arg === "--help" || arg === "-h") usage(0);
    else fail(`Unknown argument: ${arg}`);
  }

  if (args.flavor !== "both" && !FLAVORS[args.flavor]) {
    fail(`--flavor must be teacher, principal or both (got "${args.flavor}")`);
  }
  if (!TRACKS.includes(args.track)) fail(`--track must be one of ${TRACKS.join(", ")}`);
  if (!["completed", "draft"].includes(args.status)) fail(`--status must be completed or draft`);
  return args;
}

function usage(code) {
  console.log(`
Usage: node publish.mjs [options]

  --flavor  teacher | principal | both      (default: both)
  --track   internal | alpha | beta | production   (default: internal)
  --status  completed | draft               (default: completed)
  --build   build the bundles first
  --bump    raise the versionCode in pubspec.yaml before building
  --notes   release notes shown to testers (en-GB)

Environment:
  PLAY_SERVICE_ACCOUNT_JSON   path to the service account key file
`);
  process.exit(code);
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** `version: 1.2.3+45` — the number after + is the versionCode Play keys on. */
function readVersion() {
  const match = readFileSync(pubspec, "utf8").match(/^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m);
  if (!match) fail("Could not read `version: x.y.z+n` from mobile/pubspec.yaml");
  return { name: match[1], code: Number(match[2]) };
}

function bumpVersion() {
  const { name, code } = readVersion();
  const next = code + 1;
  const src = readFileSync(pubspec, "utf8");
  writeFileSync(pubspec, src.replace(/^version:\s*\d+\.\d+\.\d+\+\d+\s*$/m, `version: ${name}+${next}`));
  console.log(`  versionCode ${code} -> ${next}`);
  return { name, code: next };
}

function buildBundle(flavor) {
  const { entrypoint } = FLAVORS[flavor];
  console.log(`  building ${flavor}...`);
  execFileSync(
    "flutter",
    ["build", "appbundle", "--flavor", flavor, "-t", entrypoint, "--release"],
    { cwd: mobile, stdio: "inherit", shell: process.platform === "win32" }
  );
}

function bundlePath(flavor) {
  return join(mobile, "build", "app", "outputs", "bundle", `${flavor}Release`, `app-${flavor}-release.aab`);
}

async function upload(client, flavor, { track, status, notes }) {
  const { packageName } = FLAVORS[flavor];
  const aab = bundlePath(flavor);

  if (!existsSync(aab)) {
    fail(`No bundle at ${aab}\n  Build it first, or pass --build.`);
  }

  const sizeMb = (statSync(aab).size / 1024 / 1024).toFixed(1);
  console.log(`\n  ${flavor} -> ${packageName}`);
  console.log(`  bundle ${sizeMb} MB`);

  let editId;
  try {
    const edit = await client.edits.insert({ packageName });
    editId = edit.data.id;
  } catch (error) {
    if (error?.code === 404) {
      fail(
        `Play has no app with package name ${packageName}.\n` +
        `  Create the listing in Play Console and upload one bundle by hand first —\n` +
        `  the API can only add releases to an app that already exists.`
      );
    }
    if (error?.code === 401 || error?.code === 403) {
      fail(
        `Play refused the service account for ${packageName} (${error.code}).\n` +
        `  Check it is invited under Users and permissions with "Release to testing tracks",\n` +
        `  and that the invitation was accepted.`
      );
    }
    throw error;
  }

  const bundle = await client.edits.bundles.upload({
    packageName,
    editId,
    media: { mimeType: "application/octet-stream", body: createReadStream(aab) }
  });
  const versionCode = bundle.data.versionCode;
  console.log(`  uploaded versionCode ${versionCode}`);

  await client.edits.tracks.update({
    packageName,
    editId,
    track,
    requestBody: {
      releases: [
        {
          versionCodes: [String(versionCode)],
          status,
          ...(notes ? { releaseNotes: [{ language: "en-GB", text: notes }] } : {})
        }
      ]
    }
  });

  await client.edits.commit({ packageName, editId });
  console.log(`  committed to ${track} (${status})`);
  return versionCode;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const keyFile = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!keyFile) fail("PLAY_SERVICE_ACCOUNT_JSON is not set. See tools/play-publish/README.md");
  if (!existsSync(keyFile)) fail(`No service account key at ${keyFile}`);

  const flavors = args.flavor === "both" ? ["teacher", "principal"] : [args.flavor];

  // Both apps share pubspec's version line, so bump once for the whole run.
  const version = args.bump ? bumpVersion() : readVersion();
  console.log(`\n  SmartShala ${version.name} (versionCode ${version.code}) -> ${args.track}`);

  if (args.build) for (const flavor of flavors) buildBundle(flavor);

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"]
  });
  const client = google.androidpublisher({ version: "v3", auth: await auth.getClient() });

  for (const flavor of flavors) await upload(client, flavor, args);

  console.log(`\n  Done. Play takes a few minutes to show an internal release.\n`);
}

main().catch((error) => {
  console.error(`\n  Upload failed: ${error?.message ?? error}`);
  if (error?.errors) console.error(`  ${JSON.stringify(error.errors)}`);
  process.exit(1);
});
