import assert from "node:assert/strict";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { connectMeta, disconnectMeta, getMetaStatus, listMetaForms, setMetaForms, syncMetaLeads } from "../src/modules/crm/crm.meta.js";
import { createLead, createTeamMember } from "../src/modules/crm/crm.service.js";
import type { CrmActor } from "../src/modules/crm/crm.shared.js";

/**
 * Meta lead ads: connect a Page, pull its form leads into deals, hand them out
 * round-robin, and never import one twice. Meta's Graph API is faked; needs a
 * local master database (MASTER_DATABASE_URL).
 */
const EMAIL_DOMAIN = "@meta-test.example";
const PHONE_PREFIX = "98000000";
const PAGE_ID = "100200300";
const USER_TOKEN = "EAAuser-token-for-the-meta-test";
const PAGE_TOKEN = "EAApage-token-for-the-meta-test";
const FORM_A = "1111111";
const FORM_B = "2222222";

assert.match(process.env.MASTER_DATABASE_URL ?? "", /localhost|127\.0\.0\.1/, "point MASTER_DATABASE_URL at a local database");

const ADMIN: CrmActor = { id: null, name: "Super admin", role: "ADMIN" };

type FakeLead = { id: string; created_time: string; field_data: Array<{ name: string; values: string[] }>; campaign_name?: string };
const leadsByForm: Record<string, FakeLead[]> = { [FORM_A]: [], [FORM_B]: [] };
const calls: Array<{ path: string; params: URLSearchParams; token: string | null }> = [];
let failWith: string | null = null;

function answers(fields: Record<string, string>) {
  return Object.entries(fields).map(([name, value]) => ({ name, values: [value] }));
}

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const token = new Headers(init?.headers).get("authorization")?.replace("Bearer ", "") ?? null;
  const path = url.pathname.replace(/^\/v\d+\.\d+\//, "");
  calls.push({ path, params: url.searchParams, token });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (failWith) return json({ error: { message: failWith } }, 400);
  if (path === PAGE_ID) {
    if (token !== USER_TOKEN) return json({ error: { message: "Invalid OAuth access token" } }, 400);
    return json({ id: PAGE_ID, name: "Test Schools Page", access_token: PAGE_TOKEN });
  }
  if (token !== PAGE_TOKEN) return json({ error: { message: "Needs the Page token" } }, 400);
  if (path === `${PAGE_ID}/leadgen_forms`) {
    // Two pages of forms, to exercise paging.
    if (url.searchParams.get("after") === "p2") return json({ data: [{ id: FORM_B, name: "Demo request", status: "ACTIVE" }] });
    return json({
      data: [{ id: FORM_A, name: "Admissions software", status: "ACTIVE", leads_count: 2 }],
      paging: { next: `https://graph.facebook.com/v24.0/${PAGE_ID}/leadgen_forms?after=p2` }
    });
  }
  const form = path.match(/^(\d+)\/leads$/)?.[1];
  if (form) return json({ data: leadsByForm[form] ?? [] });
  return json({ error: { message: `Unexpected call ${path}` } }, 404);
}) as typeof fetch;

async function cleanup() {
  await masterPrisma.metaIntegration.deleteMany({});
  await masterPrisma.metaLeadImport.deleteMany({ where: { metaLeadId: { startsWith: "metatest-" } } });
  await masterPrisma.lead.deleteMany({ where: { OR: [{ email: { endsWith: EMAIL_DOMAIN } }, { phone: { startsWith: PHONE_PREFIX } }] } });
  await masterPrisma.crmUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
}

async function rejects(work: Promise<unknown>, code: string) {
  await assert.rejects(work, (error: { code?: string }) => error.code === code);
}

async function main() {
  await cleanup();
  await createTeamMember({ name: "Meta Sales One", email: `one${EMAIL_DOMAIN}`, role: "SALES", password: "password-1" });
  await createTeamMember({ name: "Meta Sales Two", email: `two${EMAIL_DOMAIN}`, role: "SALES", password: "password-1" });
  const team = await masterPrisma.crmUser.findMany({
    where: { isActive: true, role: "SALES" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true }
  });

  // --- Connecting -------------------------------------------------------------
  assert.deepEqual(await getMetaStatus(), { connected: false });
  await rejects(connectMeta(ADMIN, { pageId: PAGE_ID, accessToken: "EAAwrong-token-value-here" }), "META_API_ERROR");
  assert.deepEqual(await getMetaStatus(), { connected: false }, "a bad token saves nothing");

  const status = await connectMeta(ADMIN, { pageId: PAGE_ID, accessToken: USER_TOKEN });
  assert.equal(status.connected && status.pageName, "Test Schools Page");
  assert.ok(!("accessTokenEnc" in status), "the token never leaves the server");
  const row = await masterPrisma.metaIntegration.findUniqueOrThrow({ where: { id: "meta" } });
  assert.ok(!row.accessTokenEnc.includes(PAGE_TOKEN) && !row.accessTokenEnc.includes(USER_TOKEN), "the token is stored encrypted");

  const forms = await listMetaForms();
  assert.deepEqual(forms.map((form) => form.id), [FORM_A, FORM_B], "forms from every page of results");

  // --- First sync ---------------------------------------------------------------
  const existing = await createLead(ADMIN, {
    schoolName: "Already Talking School",
    ownerName: "Existing Owner",
    email: `existing${EMAIL_DOMAIN}`,
    phone: `${PHONE_PREFIX}03`
  });

  leadsByForm[FORM_A] = [
    {
      id: "metatest-2",
      created_time: "2026-10-09T10:05:00+0000",
      field_data: answers({ first_name: "Ravi", last_name: "Kumar", email: `ravi${EMAIL_DOMAIN}`, phone_number: `+91${PHONE_PREFIX}02` })
    },
    {
      id: "metatest-1",
      created_time: "2026-10-09T10:00:00+0000",
      campaign_name: "October admissions",
      field_data: answers({
        full_name: "Anita Rao",
        email: `ANITA${EMAIL_DOMAIN}`,
        phone_number: `+91 ${PHONE_PREFIX}01`,
        school_name: "Sunrise Public School",
        "how_many_students_do_you_have?": "500-1,000",
        city: "Pune",
        state: "Maharashtra"
      })
    }
  ];
  leadsByForm[FORM_B] = [
    { id: "metatest-3", created_time: "2026-10-09T10:10:00+0000", field_data: answers({ full_name: "Same Person", email: `existing${EMAIL_DOMAIN}` }) },
    // No email: must not be taken for a duplicate of another lead without one.
    { id: "metatest-4", created_time: "2026-10-09T10:15:00+0000", field_data: answers({ full_name: "No Email One", phone_number: `${PHONE_PREFIX}04` }) },
    { id: "metatest-5", created_time: "2026-10-09T10:20:00+0000", field_data: answers({ full_name: "No Email Two", phone_number: `${PHONE_PREFIX}05` }) }
  ];

  calls.length = 0;
  assert.deepEqual(await syncMetaLeads(), { created: 4, merged: 1, failed: 0 });
  assert.ok(!calls.some((call) => call.params.has("filtering")), "the first sync takes everything Meta still has");

  const imported = await masterPrisma.lead.findMany({ where: { source: "META" }, orderBy: { number: "asc" } });
  assert.deepEqual(
    imported.map((lead) => lead.ownerName),
    ["Anita Rao", "Ravi Kumar", "No Email One", "No Email Two"],
    "imported oldest first"
  );
  const [anita, ravi] = imported;
  assert.equal(anita.schoolName, "Sunrise Public School");
  assert.equal(anita.email, `anita${EMAIL_DOMAIN}`);
  assert.equal(anita.phone, `${PHONE_PREFIX}01`, "+91 is dropped so it matches numbers typed in the CRM");
  assert.equal(anita.numberOfStudents, 500);
  assert.equal(anita.stateName, "Maharashtra");
  assert.equal(anita.address, "Pune, Maharashtra");
  assert.equal(anita.createdBy, "Meta");
  assert.equal(ravi.schoolName, "Ravi Kumar (school name not given)");

  // Round-robin, carrying on from wherever the cursor was.
  const start = team.findIndex((user) => user.id === anita.assignedToId);
  assert.ok(start >= 0);
  imported.forEach((lead, index) => assert.equal(lead.assignedToId, team[(start + index) % team.length].id, `turn ${index}`));

  const timeline = await masterPrisma.leadActivity.findMany({ where: { leadId: anita.id, type: "META_LEAD" } });
  assert.match(timeline[0].message, /Form: Admissions software\nCampaign: October admissions/);
  assert.match(timeline[0].message, /How many students do you have\?: 500-1,000/);

  const repeat = await masterPrisma.leadActivity.findFirst({ where: { leadId: existing.id, type: "META_LEAD" } });
  assert.match(repeat?.message ?? "", /Filled a Meta lead form again/, "a known school lands on its existing deal");
  assert.equal(await masterPrisma.lead.count({ where: { email: `existing${EMAIL_DOMAIN}` } }), 1);

  // --- Later syncs ----------------------------------------------------------------
  calls.length = 0;
  assert.deepEqual(await syncMetaLeads(), { created: 0, merged: 0, failed: 0 }, "nothing is imported twice");
  const filter = calls.find((call) => call.path.endsWith("/leads"))?.params.get("filtering");
  assert.match(filter ?? "", /time_created/, "later syncs ask only for recent leads");
  assert.ok(calls.every((call) => call.token === PAGE_TOKEN), "leads are read with the Page token");

  await setMetaForms([FORM_B]);
  leadsByForm[FORM_A].push({ id: "metatest-6", created_time: "2026-10-09T11:00:00+0000", field_data: answers({ full_name: "Unchosen Form", phone_number: `${PHONE_PREFIX}06` }) });
  leadsByForm[FORM_B].push({ id: "metatest-7", created_time: "2026-10-09T11:00:00+0000", field_data: answers({ full_name: "Chosen Form", phone_number: `${PHONE_PREFIX}07` }) });
  assert.deepEqual(await syncMetaLeads(), { created: 1, merged: 0, failed: 0 }, "only the chosen forms");
  assert.equal(await masterPrisma.lead.count({ where: { phone: `${PHONE_PREFIX}06` } }), 0);

  failWith = "Error validating access token: Session has expired";
  await rejects(syncMetaLeads(), "META_API_ERROR");
  const failed = await getMetaStatus();
  assert.match((failed.connected && failed.lastSyncError) || "", /Session has expired/, "the error is shown to the admin");
  failWith = null;
  await syncMetaLeads();
  const recovered = await getMetaStatus();
  assert.equal(recovered.connected && recovered.lastSyncError, null);

  // --- Disconnecting -------------------------------------------------------------
  await disconnectMeta();
  assert.deepEqual(await getMetaStatus(), { connected: false });
  await rejects(syncMetaLeads(), "META_NOT_CONNECTED");
  await connectMeta(ADMIN, { pageId: PAGE_ID, accessToken: USER_TOKEN });
  assert.deepEqual(await syncMetaLeads(), { created: 1, merged: 0, failed: 0 }, "reconnecting only brings in the form left out earlier");

  await cleanup();
  console.log("crm meta tests passed");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => masterPrisma.$disconnect());
