import assert from "node:assert/strict";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { receiveWebsiteLead } from "../src/modules/crm/crm.website.js";
import { websiteLeadSchema } from "../src/modules/crm/crm.schemas.js";
import { createTeamMember } from "../src/modules/crm/crm.service.js";

/**
 * Demo requests posted by the marketing site: validated, handed to the
 * salesperson whose turn it is, and never turned into a second deal for a
 * school that already has one. Needs a local master database.
 */
assert.match(process.env.MASTER_DATABASE_URL ?? "", /localhost|127\.0\.0\.1/, "point MASTER_DATABASE_URL at a local database");

const DOMAIN = "@website-lead-test.example";

const body = {
  source: "website",
  name: "Sunita Sharma",
  schoolName: "Green Valley Public School",
  numberOfStudents: 650,
  role: "Principal",
  phone: "+919800000001",
  email: `sunita${DOMAIN}`,
  page: "/demo",
  utm: { utm_source: "google", utm_campaign: "admissions", gclid: "abc123" },
  submittedAt: "2026-10-12T09:30:00.000Z"
};

/** Salespeople this test did not create, parked so the turn order is its own. */
let parked: string[] = [];

async function cleanUp() {
  await masterPrisma.lead.deleteMany({ where: { OR: [{ email: { endsWith: DOMAIN } }, { phone: { startsWith: "98000000" } }] } });
  await masterPrisma.crmUser.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  if (parked.length) await masterPrisma.crmUser.updateMany({ where: { id: { in: parked } }, data: { isActive: true } });
  parked = [];
}

await cleanUp();

// --- Validation ----------------------------------------------------------------

{
  assert.equal(websiteLeadSchema.safeParse(body).success, true);
  assert.equal(websiteLeadSchema.safeParse({ ...body, name: "x" }).success, false, "a one-letter name is not a name");
  assert.equal(websiteLeadSchema.safeParse({ ...body, numberOfStudents: 99999 }).success, false, "10000 students is the ceiling");
  assert.equal(websiteLeadSchema.safeParse({ ...body, email: null }).success, true, "email is optional on the form");
  assert.equal(websiteLeadSchema.safeParse({ ...body, utm: null }).success, true, "so are the UTMs");
  assert.equal(websiteLeadSchema.safeParse({ ...body, role: "Director" }).success, true, "a new role on the form still gets through");
}

// --- Round-robin and dedupe ------------------------------------------------------

parked = (
  await masterPrisma.crmUser.findMany({ where: { isActive: true, role: "SALES" }, select: { id: true } })
).map((member) => member.id);
await masterPrisma.crmUser.updateMany({ where: { id: { in: parked } }, data: { isActive: false } });

const asha = await createTeamMember({ name: "Asha Rep", email: `asha${DOMAIN}`, role: "SALES", password: "sales-password-1" });
const rahul = await createTeamMember({ name: "Rahul Rep", email: `rahul${DOMAIN}`, role: "SALES", password: "sales-password-2" });

const first = await receiveWebsiteLead(websiteLeadSchema.parse(body));
assert.equal(first.created, true);

const second = await receiveWebsiteLead(
  websiteLeadSchema.parse({ ...body, name: "Vikram Rao", schoolName: "Sunrise Academy", phone: "+919800000002", email: `vikram${DOMAIN}` })
);
assert.equal(second.created, true);

const assignments = await masterPrisma.lead.findMany({
  where: { email: { endsWith: DOMAIN } },
  orderBy: { createdAt: "asc" },
  select: { assignedToId: true, phone: true, numberOfStudents: true, source: true, createdBy: true }
});
assert.deepEqual(
  assignments.map((lead) => lead.assignedToId),
  [asha.id, rahul.id],
  "the second lead goes to whoever has waited longest"
);
assert.equal(assignments[0].phone, "9800000001", "+91 is dropped, so it matches a phone typed into the CRM");
assert.equal(assignments[0].numberOfStudents, 650);
assert.equal(assignments[0].source, "WEBSITE");
assert.equal(assignments[0].createdBy, "Website");

// The same school asking again lands on the deal it already has.
const again = await receiveWebsiteLead(websiteLeadSchema.parse({ ...body, phone: "9800000001" }));
assert.equal(again.created, false);
assert.equal(again.code, first.code);
assert.equal(await masterPrisma.lead.count({ where: { email: { endsWith: DOMAIN } } }), 2, "no second deal for a school that already has one");

// --- What the salesperson sees ---------------------------------------------------

const lead = await masterPrisma.lead.findFirstOrThrow({ where: { email: `sunita${DOMAIN}` }, select: { id: true } });
const timeline = await masterPrisma.leadActivity.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" }, select: { type: true, message: true } });
const enquiry = timeline.find((entry) => entry.type === "WEBSITE_LEAD");
assert.ok(enquiry, "the enquiry details are on the timeline");
for (const expected of ["Page: /demo", "Role: Principal", "Students: 650", "utm_source: google", "utm_campaign: admissions", "gclid: abc123"]) {
  assert.ok(enquiry.message.includes(expected), `timeline mentions ${expected}`);
}
assert.ok(
  timeline.some((entry) => entry.type === "ENQUIRY" && entry.message.includes("again")),
  "and the repeat enquiry is on it too"
);

await cleanUp();
console.log("website leads: ok");
process.exit(0);
