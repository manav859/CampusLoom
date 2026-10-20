import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * The FCM HTTP v1 transport. Hand-rolled rather than firebase-admin: all it
 * needs is a service-account JWT traded for an access token and one POST per
 * device, and firebase-admin would pull a tree of dependencies into a 1 vCPU
 * VPS for exactly that.
 *
 * Everything here is inert until FCM_SERVICE_ACCOUNT is set — see
 * `isPushConfigured`. That is deliberate: staging, the test suite and any
 * machine without the Firebase credentials keep working, and a send is simply
 * dropped instead of throwing into the request that triggered it.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Android notification channel; must match the id the app creates. */
export const ANDROID_CHANNEL_ID = "smartshala_default";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type PushPayload = {
  title: string;
  body: string;
  /** Read by the app to decide which screen a tap opens. */
  data: Record<string, string>;
};

/** `stale` means the registration is dead and its row should go. */
export type SendOutcome = "sent" | "stale" | "failed";

let serviceAccount: ServiceAccount | null | undefined;
let accessToken: { value: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;

  try {
    // A path is the normal case; the JSON itself is there for hosts where only
    // environment variables can be set.
    const json = raw.startsWith("{") ? raw : readFileSync(raw, "utf8");
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      logger.error("FCM_SERVICE_ACCOUNT is missing project_id, client_email or private_key");
      return null;
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // A key pasted into an env var arrives with literal \n sequences.
      privateKey: parsed.private_key.replace(/\\n/g, "\n")
    };
  } catch (error) {
    logger.error({ err: error }, "FCM_SERVICE_ACCOUNT could not be read");
    return null;
  }
}

function getServiceAccount() {
  if (serviceAccount === undefined) serviceAccount = readServiceAccount();
  return serviceAccount;
}

export function isPushConfigured() {
  return getServiceAccount() !== null;
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

/** Self-signed JWT traded for an OAuth access token, per Google's server flow. */
function signAssertion(account: ServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600
    })
  );

  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.privateKey)
    .toString("base64url");

  return `${header}.${claims}.${signature}`;
}

async function getAccessToken(account: ServiceAccount) {
  // Reused until a minute before it expires, so a burst of notifications costs
  // one token exchange rather than one per device.
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) return accessToken.value;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signAssertion(account)
    }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`FCM token exchange failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  accessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };
  return accessToken.value;
}

/**
 * A registration FCM has rejected for good: 404 UNREGISTERED is an uninstalled
 * app or a replaced installation, and 400 INVALID_ARGUMENT a malformed FID.
 * Anything else — a 5xx, a quota error, a network blip — is a failure to retry,
 * not a dead device. 403 SENDER_ID_MISMATCH is deliberately not stale: it means
 * *our* credentials are wrong, and pruning on it would delete every
 * registration in the school on the first misconfigured deploy.
 */
function isStale(status: number, errorStatus: string | undefined) {
  if (status === 404) return true;
  return status === 400 && errorStatus === "INVALID_ARGUMENT";
}

/**
 * One notification to one app install, addressed by its Firebase Installation
 * ID. `fid` is what replaced the deprecated `token` field in the HTTP v1 send
 * API; the two are mutually exclusive.
 */
export async function sendToDevice(fid: string, payload: PushPayload): Promise<SendOutcome> {
  const account = getServiceAccount();
  if (!account) return "failed";

  let bearer: string;
  try {
    bearer = await getAccessToken(account);
  } catch (error) {
    logger.error({ err: error }, "FCM access token could not be obtained");
    return "failed";
  }

  const message = {
    message: {
      fid,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: {
        priority: "HIGH",
        notification: {
          channel_id: ANDROID_CHANNEL_ID,
          // Two notices about the same leave request replace each other rather
          // than stacking up in the shade.
          tag: payload.data.kind
        }
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default" } }
      }
    }
  };

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(20_000)
      }
    );

    if (response.ok) return "sent";

    const text = await response.text();
    let errorStatus: string | undefined;
    try {
      errorStatus = (JSON.parse(text) as { error?: { status?: string } }).error?.status;
    } catch {
      errorStatus = undefined;
    }

    if (isStale(response.status, errorStatus)) return "stale";

    logger.warn({ status: response.status, errorStatus, body: text.slice(0, 300) }, "FCM send failed");
    return "failed";
  } catch (error) {
    logger.warn({ err: error }, "FCM send could not be delivered");
    return "failed";
  }
}
