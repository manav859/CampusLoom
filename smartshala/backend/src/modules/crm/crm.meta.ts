import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { CrmRole, Prisma } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { createMetaLead, type LeadInput } from "./crm.service.js";
import type { CrmActor } from "./crm.shared.js";

/**
 * Meta (Facebook/Instagram) lead ads. An admin connects a Page with a token
 * from Meta Business Manager; every few minutes the server pulls new leads from
 * the Page's lead forms and hands them out round-robin to the sales team.
 */

const GRAPH = "https://graph.facebook.com/v24.0";
const ROW_ID = "meta";
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
/** Each sync looks back this far past the last one, in case Meta was slow to list a lead. */
const SYNC_OVERLAP_MS = 24 * 60 * 60 * 1000;

function assertMaster() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "The CRM is unavailable because the master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

// --- The stored token ----------------------------------------------------------

const TOKEN_KEY = createHash("sha256").update(`meta-page-token:${env.JWT_ACCESS_SECRET}`).digest();

function sealToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", TOKEN_KEY, iv);
  const sealed = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString("base64")).join(".");
}

function openToken(stored: string) {
  try {
    const [iv, tag, sealed] = stored.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", TOKEN_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(sealed), decipher.final()]).toString("utf8");
  } catch {
    // The server's secret changed since the Page was connected.
    throw new AppError(409, "The saved Meta token can no longer be read. Connect the Page again.", "META_TOKEN_UNREADABLE");
  }
}

// --- Graph API -------------------------------------------------------------------

type Paged<T> = { data: T[]; paging?: { next?: string } };
type MetaForm = { id: string; name: string; status: string; leads_count?: number };
type MetaAnswer = { name: string; values?: string[] };
type MetaLead = { id: string; created_time: string; field_data?: MetaAnswer[]; campaign_name?: string; ad_name?: string };

async function graph<T>(pathOrUrl: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH}/${pathOrUrl}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new AppError(502, `Could not reach Meta: ${err instanceof Error ? err.message : String(err)}`, "META_UNREACHABLE");
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || !body || body.error) {
    throw new AppError(502, `Meta said: ${body?.error?.message ?? `HTTP ${response.status}`}`, "META_API_ERROR");
  }
  return body;
}

async function graphAll<T>(path: string, token: string, params: Record<string, string>) {
  const rows: T[] = [];
  let page = await graph<Paged<T>>(path, token, { ...params, limit: "100" });
  rows.push(...page.data);
  while (page.paging?.next) {
    page = await graph<Paged<T>>(page.paging.next, token);
    rows.push(...page.data);
  }
  return rows;
}

function fetchForms(pageId: string, token: string) {
  return graphAll<MetaForm>(`${pageId}/leadgen_forms`, token, { fields: "id,name,status,leads_count" });
}

// --- Connecting ------------------------------------------------------------------

async function integration() {
  assertMaster();
  return masterPrisma.metaIntegration.findUnique({ where: { id: ROW_ID } });
}

async function connected() {
  const row = await integration();
  if (!row) throw new AppError(404, "No Meta Page is connected", "META_NOT_CONNECTED");
  return { row, token: openToken(row.accessTokenEnc) };
}

export async function getMetaStatus() {
  const row = await integration();
  if (!row) return { connected: false as const };
  const imported = await masterPrisma.lead.count({ where: { source: "META" } });
  const { accessTokenEnc: _secret, lastAssignedUserId: _cursor, ...rest } = row;
  // Without background workers on this server, only "Sync now" brings leads in.
  return { connected: true as const, ...rest, imported, autoSync: env.BACKGROUND_WORKERS_ENABLED };
}

/**
 * Takes a System User (or Page) token. A user token is swapped for the Page's
 * own token, which is what reading leads needs; from a System User it never expires.
 */
export async function connectMeta(actor: CrmActor, input: { pageId: string; accessToken: string }) {
  assertMaster();
  const page = await graph<{ id: string; name: string; access_token?: string }>(input.pageId, input.accessToken, {
    fields: "id,name,access_token"
  });
  const pageToken = page.access_token ?? input.accessToken;
  // Proves the token may read lead forms before anything is saved.
  await graph(`${page.id}/leadgen_forms`, pageToken, { fields: "id", limit: "1" });

  const existing = await integration();
  const samePage = existing?.pageId === page.id;
  await masterPrisma.metaIntegration.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, pageId: page.id, pageName: page.name, accessTokenEnc: sealToken(pageToken), connectedBy: actor.name },
    update: {
      pageId: page.id,
      pageName: page.name,
      accessTokenEnc: sealToken(pageToken),
      connectedBy: actor.name,
      lastSyncError: null,
      ...(samePage ? {} : { formIds: [], lastSyncedAt: null })
    }
  });
  return getMetaStatus();
}

export async function disconnectMeta() {
  assertMaster();
  // The import log stays, so reconnecting never brings old leads back twice.
  await masterPrisma.metaIntegration.deleteMany({ where: { id: ROW_ID } });
}

export async function listMetaForms() {
  const { row, token } = await connected();
  const forms = await fetchForms(row.pageId, token);
  return forms.map((form) => ({ id: form.id, name: form.name, status: form.status, leadsCount: form.leads_count ?? null }));
}

export async function setMetaForms(formIds: string[]) {
  await connected();
  await masterPrisma.metaIntegration.update({ where: { id: ROW_ID }, data: { formIds } });
  return getMetaStatus();
}

// --- Turning a Meta lead into a deal -------------------------------------------

/** "+91 98765 43210" and "9876543210" are the same school; keep the form the CRM uses. */
function cleanPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return raw.trim();
}

function firstNumber(text: string) {
  const match = text.replace(/,/g, "").match(/\d+/);
  return match ? Math.min(Number(match[0]), 100000) : null;
}

/** "how_many_students?" → "How many students?" */
function questionLabel(name: string) {
  const text = name.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Meta forms have a few standard keys (full_name, email, phone_number, city…)
 * and whatever custom questions the form asks; the custom ones are matched by
 * the words in their keys. Every answer also goes on the deal's timeline.
 */
export function leadFromMeta(answers: MetaAnswer[]): LeadInput {
  const lead: LeadInput = { schoolName: "", ownerName: "", email: "", phone: "" };
  let firstName = "";
  let lastName = "";
  const address: string[] = [];

  for (const answer of answers) {
    const key = answer.name.toLowerCase();
    const value = (answer.values ?? []).join(", ").trim();
    if (!value) continue;

    if (key.includes("email")) lead.email ||= value;
    else if (/phone|mobile|whatsapp|contact_number/.test(key)) lead.phone ||= cleanPhone(value);
    else if (/school|institut|college|academy|company|organi[sz]ation/.test(key)) lead.schoolName ||= value;
    else if (key === "first_name") firstName = value;
    else if (key === "last_name") lastName = value;
    else if (key.includes("name")) lead.ownerName ||= value;
    else if (key.includes("student")) lead.numberOfStudents ??= firstNumber(value);
    else if (/staff|teacher|employee/.test(key)) lead.numberOfStaff ??= firstNumber(value);
    else if (key === "state" || key === "province") {
      lead.stateName = value;
      address.push(value);
    } else if (/street|address|city|zip|post_code|postal|country/.test(key)) address.push(value);
  }

  lead.ownerName ||= [firstName, lastName].filter(Boolean).join(" ") || "Meta lead";
  lead.schoolName ||= `${lead.ownerName} (school name not given)`;
  if (address.length) lead.address = address.join(", ");
  return lead;
}

function leadDetails(lead: MetaLead, formName: string) {
  const source = [`Form: ${formName}`, lead.campaign_name ? `Campaign: ${lead.campaign_name}` : null, lead.ad_name ? `Ad: ${lead.ad_name}` : null];
  const answers = (lead.field_data ?? []).map((answer) => `${questionLabel(answer.name)}: ${(answer.values ?? []).join(", ")}`);
  return [...source.filter(Boolean), ...answers].join("\n");
}

/** The next active salesperson after the one who got the last Meta lead. */
function nextInTurn(team: Array<{ id: string }>, lastId: string | null) {
  if (team.length === 0) return null;
  const last = team.findIndex((user) => user.id === lastId);
  return team[(last + 1) % team.length].id;
}

// --- Syncing ---------------------------------------------------------------------

export type MetaSyncResult = { created: number; merged: number; failed: number };

let running: Promise<MetaSyncResult> | null = null;

/** Pulls every new lead from the chosen forms. Two calls at once share one run. */
export function syncMetaLeads() {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function runSync(): Promise<MetaSyncResult> {
  const { row, token } = await connected();
  const startedAt = new Date();
  const result: MetaSyncResult = { created: 0, merged: 0, failed: 0 };
  let lastAssignedUserId = row.lastAssignedUserId;

  try {
    const allForms = await fetchForms(row.pageId, token);
    const forms = row.formIds.length ? allForms.filter((form) => row.formIds.includes(form.id)) : allForms;
    const since = row.lastSyncedAt ? Math.floor((row.lastSyncedAt.getTime() - SYNC_OVERLAP_MS) / 1000) : null;

    const incoming: Array<{ lead: MetaLead; form: MetaForm }> = [];
    for (const form of forms) {
      const leads = await graphAll<MetaLead>(`${form.id}/leads`, token, {
        fields: "id,created_time,field_data,campaign_name,ad_name",
        ...(since ? { filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]) } : {})
      });
      incoming.push(...leads.map((lead) => ({ lead, form })));
    }

    const seen = new Set(
      (
        await masterPrisma.metaLeadImport.findMany({
          where: { metaLeadId: { in: incoming.map(({ lead }) => lead.id) } },
          select: { metaLeadId: true }
        })
      ).map((row) => row.metaLeadId)
    );
    const fresh = incoming
      .filter(({ lead }) => !seen.has(lead.id))
      .sort((a, b) => a.lead.created_time.localeCompare(b.lead.created_time));

    const team = fresh.length
      ? await masterPrisma.crmUser.findMany({
          where: { isActive: true, role: CrmRole.SALES },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true }
        })
      : [];

    for (const { lead, form } of fresh) {
      try {
        const turn = nextInTurn(team, lastAssignedUserId);
        const outcome = await createMetaLead(leadFromMeta(lead.field_data ?? []), leadDetails(lead, form.name), turn);
        if (outcome.created) {
          result.created += 1;
          lastAssignedUserId = turn;
        } else {
          result.merged += 1;
        }
        await masterPrisma.metaLeadImport.create({ data: { metaLeadId: lead.id, formId: form.id, leadId: outcome.leadId } }).catch((err) => {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
        });
      } catch (err) {
        // Not recorded, so the next sync tries this one again.
        result.failed += 1;
        logger.error({ err, metaLeadId: lead.id }, "Failed to import a Meta lead");
      }
    }

    await masterPrisma.metaIntegration.update({
      where: { id: ROW_ID },
      data: { lastSyncedAt: startedAt, lastSyncError: null, lastAssignedUserId }
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await masterPrisma.metaIntegration
      .update({ where: { id: ROW_ID }, data: { lastSyncError: message, lastAssignedUserId } })
      .catch(() => undefined);
    throw err;
  }
}

export function startMetaLeadWorker() {
  if (env.NODE_ENV === "test" || !env.MASTER_DATABASE_URL || !env.BACKGROUND_WORKERS_ENABLED) return;

  const tick = () =>
    void integration()
      .then((row) => (row ? syncMetaLeads() : null))
      .then((result) => {
        if (result && (result.created || result.merged || result.failed)) logger.info(result, "Meta leads synced");
      })
      .catch((err) => logger.error({ err }, "Meta lead sync failed"));

  tick();
  const timer = setInterval(tick, SYNC_INTERVAL_MS);
  timer.unref?.();
}
