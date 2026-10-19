#!/usr/bin/env node
/**
 * Creates the production UptimeRobot monitors through the official CLI.
 *
 *   node deploy/setup-uptime-monitors.mjs --api-key u1234567-...
 *   node deploy/setup-uptime-monitors.mjs --dry-run     # validate, no network
 *
 * The key can also come from UPTIMEROBOT_API_KEY, but --api-key avoids the
 * per-shell syntax for setting one (PowerShell has no `VAR=x cmd` prefix).
 *
 * Re-running is safe: monitors are matched by name and skipped if they exist.
 *
 * Three monitors, not one, because pm2 runs smartshala-api and smartshala-web as
 * separate processes — watching only the API would stay green while the whole UI
 * was down. All three are KEYWORD monitors rather than plain HTTP: a 200 with a
 * broken body is still an outage, and the load test showed this box degrades
 * (10s responses, still HTTP 200) long before it ever stops answering.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** Reads `--flag value`, falling back to an env var. */
function arg(flag, envVar) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return envVar ? process.env[envVar] : undefined;
}

const API_KEY = arg("--api-key", "UPTIMEROBOT_API_KEY");
const DRY_RUN = process.argv.includes("--dry-run");
const ALERT_EMAIL = arg("--email", "UPTIMEROBOT_ALERT_EMAIL") ?? "nayan@hybridmonks.com";

// Free plan checks every 5 minutes; paid plans go down to 60s. Pass
// --interval 60 once the account is on a paid tier.
const INTERVAL = Number(arg("--interval", "UPTIMEROBOT_INTERVAL") ?? 300);

const HOST = "https://app.letssmartshala.com";

if (!API_KEY && !DRY_RUN) {
  console.error("No API key given.");
  console.error("Create a Main API key at https://dashboard.uptimerobot.com → Integrations & API,");
  console.error("then re-run:  node deploy/setup-uptime-monitors.mjs --api-key <your-key>");
  process.exit(1);
}

/**
 * Timeouts are deliberately far below UptimeRobot's 30s default. Idle TTFB on
 * these endpoints is 170-250ms, so anything past a few seconds already means
 * the single vCPU is saturated. responseTimeThreshold catches the slow-but-up
 * state that a pure up/down check misses entirely.
 */
const MONITORS = [
  {
    name: "SmartShala API (process)",
    url: `${HOST}/api/health`,
    keyword: '"status":"ok"',
    timeout: 15,
    responseTimeThreshold: 2000,
    // Cert and domain expiry are flags on a monitor, not a monitor type of
    // their own, so they ride along here. certbot renews automatically, but a
    // silent renewal failure takes the whole site down.
    ssl: true,
  },
  {
    name: "SmartShala Database",
    url: `${HOST}/health/db`,
    keyword: '"database":"connected"',
    timeout: 15,
    responseTimeThreshold: 2000,
    ssl: false,
  },
  {
    name: "SmartShala Web (frontend)",
    url: `${HOST}/SS000001/login`,
    // The rendered password field, not page copy: it survives wording changes
    // and is absent from a Next.js error page, which still ships /_next/static
    // and would otherwise pass a laxer keyword.
    keyword: 'type="password"',
    // Next.js SSR is the slowest path measured (~130 rps ceiling), so it gets
    // more headroom than the API endpoints.
    timeout: 20,
    responseTimeThreshold: 4000,
    ssl: false,
  },
];

/**
 * Run the CLI's entry script with this same node binary. Going through `npx`
 * instead would mean spawning a .cmd shim on Windows, which Node refuses
 * without a shell — and a shell concatenates these args unescaped, splitting
 * every monitor name on its spaces.
 */
const CLI_ENTRY = (() => {
  try {
    const require = createRequire(import.meta.url);
    return join(dirname(require.resolve("@uptimerobot/cli/package.json")), "bin", "run.js");
  } catch {
    console.error("@uptimerobot/cli is not installed. From the repo root run:\n");
    console.error("  npm install --no-save @uptimerobot/cli@1.0.0\n");
    process.exit(1);
  }
})();

function cli(args, { capture = true } = {}) {
  const full = [CLI_ENTRY, ...args];
  if (DRY_RUN) full.push("--dry-run");
  try {
    const out = execFileSync(process.execPath, full, {
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, UPTIMEROBOT_API_KEY: API_KEY ?? "" },
    });
    return out;
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    throw new Error(detail || err.message);
  }
}

/** The CLI wraps payloads inconsistently across commands; dig out the array. */
function rows(raw) {
  if (!raw?.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  for (const v of [parsed, parsed?.data, parsed?.monitors, parsed?.alertContacts, parsed?.result]) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * Look for an existing contact by email. Two listings are checked because they
 * cover different collections: `user alert-contacts` returns the account's own
 * contacts (including the default one UptimeRobot creates for the login email),
 * while `alert-contacts list` returns only the separately-managed personal
 * ones. Checking just the latter misses the default and makes `create` 409.
 */
function findContact(email) {
  const target = email.toLowerCase();
  for (const cmd of [
    ["user", "alert-contacts", "--json"],
    ["alert-contacts", "list", "--json"],
  ]) {
    let list;
    try {
      list = rows(cli(cmd));
    } catch {
      continue;
    }
    const hit = list.find((c) =>
      [c.value, c.email, c.name, c.friendlyName].some(
        (f) => String(f ?? "").toLowerCase() === target
      )
    );
    if (hit?.id) return hit.id;
  }
  return undefined;
}

async function main() {
  if (process.argv.includes("--list-contacts")) {
    for (const cmd of [["user", "alert-contacts"], ["alert-contacts", "list"], ["integrations", "list"]]) {
      console.log(`\n--- ${cmd.join(" ")} ---`);
      try {
        console.log(cli([...cmd, "--json"]).trim() || "(empty)");
      } catch (err) {
        console.log(`failed: ${err.message}`);
      }
    }
    return;
  }

  console.log(`UptimeRobot setup${DRY_RUN ? "  [DRY RUN — no network, no API key used]" : ""}`);
  console.log(`interval=${INTERVAL}s  alert email=${ALERT_EMAIL}\n`);

  // --- alert contact ---------------------------------------------------------
  let contactId;
  if (!DRY_RUN) {
    contactId = findContact(ALERT_EMAIL);
    if (contactId) {
      console.log(`email contact found (id=${contactId})`);
    } else {
      try {
        const created = cli([
          "alert-contacts", "create",
          "--type", "Email",
          "--value", ALERT_EMAIL,
          "--name", "SmartShala alerts",
          "--json",
        ]);
        let obj;
        try { obj = JSON.parse(created); } catch { obj = {}; }
        contactId = obj.id ?? obj.data?.id;
        console.log(`created email contact (id=${contactId ?? "unknown"})`);
      } catch (err) {
        // UptimeRobot stores alert contacts as integrations internally, so a
        // duplicate comes back as "This integration already exists" (409). The
        // contact is there either way, so this must not abort the run.
        if (!/already exists|409/i.test(err.message)) throw err;
        contactId = findContact(ALERT_EMAIL);
        console.log(
          contactId
            ? `email contact already existed (id=${contactId})`
            : `email contact ${ALERT_EMAIL} already exists but its id is not readable`
        );
      }
    }
    if (!contactId) {
      console.log("  -> creating monitors unassigned; attach the contact in the dashboard");
      console.log("  -> to inspect what the account has: node deploy/setup-uptime-monitors.mjs --api-key <key> --list-contacts");
    }
  }

  // --- monitors --------------------------------------------------------------
  const present = DRY_RUN ? [] : rows(cli(["monitors", "list", "--json"]));
  const byName = new Set(present.map((m) => m.friendlyName ?? m.name));

  for (const m of MONITORS) {
    if (byName.has(m.name)) {
      console.log(`skip   ${m.name} — already exists`);
      continue;
    }

    const args = [
      "monitors", "create", "keyword",
      "--name", m.name,
      "--url", m.url,
      "--interval", String(INTERVAL),
      "--timeout", String(m.timeout),
      // Alert when the keyword is ABSENT — a 200 carrying the wrong body is an
      // outage as far as users are concerned.
      "--keyword-type", "ALERT_NOT_EXISTS",
      "--keyword-value", m.keyword,
      "--keyword-case-type", "CaseSensitive",
      "--response-time-threshold", String(m.responseTimeThreshold),
      // Default is [2xx, 3xx]; none of these endpoints should ever redirect, so
      // a 3xx means something is misrouted and should count as down.
      "--success-http-response-codes", "2xx",
      // Retry once on a 4xx/5xx before alerting. Connection errors always retry
      // three times regardless. This softens the single-vCPU blips without
      // hiding a real outage.
      "--config-application-error-retries", "1",
      "--follow-redirects",
      "--json",
    ];

    if (m.ssl) args.push("--check-ssl", "--ssl-expiration-reminder", "--domain-expiration-reminder");
    if (contactId) args.push("--assigned-alert-contacts", String(contactId));

    try {
      cli(args);
      console.log(`create ${m.name}`);
      console.log(`         ${m.url}  keyword=${m.keyword}  timeout=${m.timeout}s`);
    } catch (err) {
      console.error(`FAILED ${m.name}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  console.log(DRY_RUN ? "\nvalidated — re-run without --dry-run to create" : "\ndone");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
