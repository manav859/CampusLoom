// Upload App Store screenshots — the one asset flow asc.mjs cannot express,
// because committing an image is three calls and a binary PUT to a signed URL
// on another host, not a single REST request.
//
//   node screenshots.mjs <appStoreVersionLocalizationId> shot_a.png shot_b.png
//
// Images appear on the listing in the order given. Apple wants 1320x2868 for
// the 6.9" display — which the API still calls APP_IPHONE_67, there is no
// _69 — and rejects anything with an alpha channel.
import { createSign, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { homedir } from "node:os";

const KEY_ID = process.env.ASC_KEY_ID ?? "F5ZA3HP979";
const ISSUER = process.env.ASC_ISSUER_ID ?? "a7fcde31-f275-42f5-8627-3f12662eb03a";
const KEY = readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`, "utf8");
const DISPLAY_TYPE = "APP_IPHONE_67";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  const sig = signer.sign({ key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

async function api(method, path, payload) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}\n${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}

const [localization, ...files] = process.argv.slice(2);
if (!localization || files.length === 0) {
  console.error("usage: node screenshots.mjs <localizationId> <image.png...>");
  process.exit(1);
}

// One set per display type per localization — reuse it if a previous run made it.
const sets = await api("GET", `/v1/appStoreVersionLocalizations/${localization}/appScreenshotSets`);
let set = sets.data.find((s) => s.attributes.screenshotDisplayType === DISPLAY_TYPE);
if (set) {
  console.log(`set ${set.id} (existing)`);
} else {
  const created = await api("POST", "/v1/appScreenshotSets", {
    data: {
      type: "appScreenshotSets",
      attributes: { screenshotDisplayType: DISPLAY_TYPE },
      relationships: {
        appStoreVersionLocalization: {
          data: { type: "appStoreVersionLocalizations", id: localization }
        }
      }
    }
  });
  set = created.data;
  console.log(`set ${set.id} (created)`);
}

for (const file of files) {
  const bytes = readFileSync(file);
  const fileName = basename(file);

  // Reserve: Apple hands back the URLs and headers to PUT the bytes to.
  const reserved = await api("POST", "/v1/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileName, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } }
    }
  });
  const { id } = reserved.data;

  for (const op of reserved.data.attributes.uploadOperations) {
    const res = await fetch(op.url, {
      method: op.method,
      headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
      body: bytes.subarray(op.offset, op.offset + op.length)
    });
    if (!res.ok) throw new Error(`upload ${fileName} -> HTTP ${res.status}`);
  }

  // Commit: until this lands the reservation is an empty placeholder.
  await api("PATCH", `/v1/appScreenshots/${id}`, {
    data: {
      type: "appScreenshots",
      id,
      attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") }
    }
  });
  console.log(`  ${fileName} -> ${id}`);
}
