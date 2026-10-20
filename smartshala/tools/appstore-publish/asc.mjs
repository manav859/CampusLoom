// Minimal App Store Connect API client — what altool cannot do, which is
// everything except uploading a binary: listing metadata, age rating, review
// details, screenshots.
//
//   node asc.mjs GET /v1/apps
//   node asc.mjs PATCH /v1/appInfos/ID '{"data":{...}}'
//
// The private key is never in this repository. Download it once from App Store
// Connect (Users and Access -> Integrations -> Team Keys) and leave it at
// ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8, chmod 600.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// Identifiers, not secrets: useless without the .p8 above. Override for a
// different team.
const KEY_ID = process.env.ASC_KEY_ID ?? "F5ZA3HP979";
const ISSUER = process.env.ASC_ISSUER_ID ?? "a7fcde31-f275-42f5-8627-3f12662eb03a";
const KEY = readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`, "utf8");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  // ASC rejects the DER encoding Node emits by default.
  const sig = signer.sign({ key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

const [method, path, payload] = process.argv.slice(2);
const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${token()}`,
    ...(payload ? { "Content-Type": "application/json" } : {})
  },
  ...(payload ? { body: payload } : {})
});

const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text.slice(0, 2000));
}
