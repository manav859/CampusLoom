import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { handleRazorpayWebhook } from "../src/modules/billing/billing.service.js";
import {
  confirmPaymentLinkPayment,
  getPaymentLinkView,
  payPaymentLinkViaMockGateway,
  startPaymentLinkCheckout
} from "../src/modules/billing/paymentLinks.service.js";
import { signWebhook } from "../src/services/razorpay/index.js";
import { issueLoginDetails } from "../src/modules/crm/crm.conversion.js";
import {
  addNote,
  createLead,
  createLeadPaymentLink,
  createTeamMember,
  createWebsiteLead,
  getLead,
  issueProforma,
  listCrmPayments,
  listLeads,
  renderLeadInvoicePdf,
  renderProformaPdf,
  retryOnboarding,
  updateLead
} from "../src/modules/crm/crm.service.js";
import type { CrmActor } from "../src/modules/crm/crm.shared.js";

/**
 * The sales CRM end to end: lead → proforma → payment link → payment → school.
 *
 * Needs a local master database (MASTER_DATABASE_URL), a local tenant database
 * in DATABASE_URL (it stands in for the new school's database), and the mock
 * gateway (RAZORPAY_MODE=mock). Without Neon credentials the automatic setup
 * fails at "create the database", which is exactly the failure-then-retry path
 * this test wants: it then provides the school row itself and retries.
 */
const PLAN_CODE = "CRMTEST";
const EMAIL_DOMAIN = "@crm-test.example";
const TENANT_URL = process.env.DATABASE_URL!;

assert.match(process.env.MASTER_DATABASE_URL ?? "", /localhost|127\.0\.0\.1/, "point MASTER_DATABASE_URL at a local database");
assert.match(TENANT_URL, /localhost|127\.0\.0\.1/, "point DATABASE_URL at a local database");
assert.equal(process.env.RAZORPAY_MODE, "mock", "run with RAZORPAY_MODE=mock");

const ADMIN: CrmActor = { id: null, name: "Super admin", role: "ADMIN" };

async function cleanup() {
  const leads = await masterPrisma.lead.findMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  const schoolIds = leads.map((lead) => lead.schoolId).filter((id): id is string => Boolean(id));
  await masterPrisma.payment.deleteMany({ where: { proforma: { leadId: { in: leads.map((lead) => lead.id) } } } });
  await masterPrisma.school.deleteMany({ where: { schoolId: { in: schoolIds } } });
  await masterPrisma.lead.deleteMany({ where: { id: { in: leads.map((lead) => lead.id) } } });
  await masterPrisma.crmUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await masterPrisma.plan.deleteMany({ where: { code: PLAN_CODE } });
}

async function rejects(work: Promise<unknown>, code: string) {
  await assert.rejects(work, (error: { code?: string }) => error.code === code);
}

async function waitForOnboarding(leadId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const lead = await masterPrisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (lead.onboardingStatus !== "RUNNING" && lead.onboardingStatus !== "NOT_STARTED") return lead;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Onboarding did not finish");
}

async function main() {
  await cleanup();
  await masterPrisma.plan.create({
    data: { code: PLAN_CODE, name: "CRM Test Annual", priceMinor: 2100000, interval: "YEAR", intervalCount: 1 }
  });

  // --- Team & scoping -------------------------------------------------------
  const ravi = await createTeamMember({ name: "Ravi Sales", email: `ravi${EMAIL_DOMAIN}`, role: "SALES", password: "password-1" });
  const meena = await createTeamMember({ name: "Meena Sales", email: `meena${EMAIL_DOMAIN}`, role: "SALES", password: "password-2" });
  const asRavi: CrmActor = { id: ravi.id, name: ravi.name, role: "SALES" };
  const asMeena: CrmActor = { id: meena.id, name: meena.name, role: "SALES" };

  const created = await createLead(asRavi, {
    schoolName: "Sandipani Technical Campus",
    ownerName: "Vishal Agrawal",
    email: `Principal${EMAIL_DOMAIN}`,
    phone: "9405044227",
    address: "12 Station Road, Indore",
    gstin: "23aabcs1429b1zp",
    stateName: "Madhya Pradesh",
    numberOfStudents: 800,
    numberOfStaff: 45,
    // A salesperson cannot hand their lead to someone else.
    assignedToId: meena.id
  });
  assert.match(created.code, /^LD-\d{6}$/);
  assert.equal(created.assignedToId, ravi.id);
  assert.equal(created.email, `principal${EMAIL_DOMAIN}`);
  assert.equal(created.gstin, "23AABCS1429B1ZP");
  assert.equal(created.stateCode, "23", "state read off the GSTIN");

  await rejects(
    createLead(asMeena, { schoolName: "Same school", ownerName: "Someone", email: `other${EMAIL_DOMAIN}`, phone: "9405044227" }),
    "LEAD_DUPLICATE"
  );
  await rejects(getLead(asMeena, created.id), "LEAD_NOT_FOUND");
  assert.equal((await listLeads(asMeena, {})).leads.length, 0);
  assert.equal((await listLeads(asRavi, { q: created.code })).leads.length, 1);

  await addNote(asRavi, created.id, "Called the principal, wants the annual plan");
  await updateLead(asRavi, created.id, { stage: "CONTACTED" });
  await rejects(updateLead(asRavi, created.id, { stage: "PAID" }), "LEAD_STAGE_LOCKED");
  await rejects(updateLead(asRavi, created.id, { assignedToId: meena.id }), "CRM_ADMIN_REQUIRED");

  // --- Proforma -------------------------------------------------------------
  // List price 21,000; agreed at 20,000; GST 18% → 23,600.
  const first = await issueProforma(asRavi, created.id, { planCode: PLAN_CODE, priceRupees: 20500 });
  const firstLink = await createLeadPaymentLink(asRavi, first.id, {});
  const proforma = await issueProforma(asRavi, created.id, { planCode: PLAN_CODE, priceRupees: 20000, notes: "Includes setup" });
  assert.match(proforma.number, /^PI-\d{4}-\d{6}$/);
  assert.equal(proforma.listPriceMinor, 2100000);
  assert.equal(proforma.subtotalMinor, 2000000);
  assert.equal(proforma.taxMinor, 360000);
  assert.equal(proforma.totalMinor, 2360000);

  const superseded = await masterPrisma.proforma.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(superseded.status, "CANCELLED", "a revised proforma replaces the old one");
  await rejects(getPaymentLinkView(firstLink.token), "PAYMENT_LINK_REVOKED");

  const pdf = await renderProformaPdf(asRavi, proforma.id);
  assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");

  const link = await createLeadPaymentLink(asRavi, proforma.id, { note: "Annual plan for 2026-27" });
  assert.ok(link.shareText.includes(link.url));
  assert.ok(link.shareText.includes("₹23,600.00"));
  assert.equal((await masterPrisma.lead.findUniqueOrThrow({ where: { id: created.id } })).stage, "PROFORMA_SENT");

  // --- The school pays --------------------------------------------------------
  const view = await getPaymentLinkView(link.token);
  assert.equal(view.kind, "PROFORMA");
  assert.equal(view.state, "PAYABLE");
  assert.equal(view.school.schoolId, null, "no school ID before payment");
  assert.equal(view.invoice.amountDueMinor, 2360000);
  assert.equal(view.invoice.periodStart, null);

  const session = await startPaymentLinkCheckout(link.token);
  assert.equal(session.mode, "MOCK");
  assert.equal(session.school.phone, "9405044227");

  const failed = await payPaymentLinkViaMockGateway({ token: link.token, orderId: session.orderId, outcome: "failure", method: "card" });
  assert.equal(failed.status, "failed");

  const retry = await startPaymentLinkCheckout(link.token);
  assert.notEqual(retry.orderId, session.orderId, "a failed order is not reused");
  const paid = await payPaymentLinkViaMockGateway({ token: link.token, orderId: retry.orderId, outcome: "success", method: "upi" });
  assert.equal(paid.status, "success");

  // The webhook got there first; the browser's confirmation is the second writer.
  const confirmed = await confirmPaymentLinkPayment(link.token, {
    razorpay_order_id: paid.razorpay_order_id!,
    razorpay_payment_id: paid.razorpay_payment_id!,
    razorpay_signature: paid.razorpay_signature!
  });
  assert.equal(confirmed.alreadyCaptured, true);

  const replay = JSON.stringify({
    entity: "event",
    event: "payment.captured",
    payload: { payment: { entity: { id: paid.razorpay_payment_id, order_id: paid.razorpay_order_id, amount: 2360000, method: "upi" } } }
  });
  await handleRazorpayWebhook(replay, signWebhook(replay));

  const settled = await masterPrisma.proforma.findUniqueOrThrow({ where: { id: proforma.id } });
  assert.equal(settled.status, "PAID");
  assert.equal(settled.amountPaidMinor, 2360000, "paid exactly once despite three deliveries");
  assert.equal((await getPaymentLinkView(link.token)).state, "PAID");

  // No Neon credentials here, so creating the database fails — and says so.
  const failedSetup = await waitForOnboarding(created.id);
  assert.equal(failedSetup.stage, "PAID");
  assert.match(failedSetup.schoolId ?? "", /^[A-Z0-9]{8}$/);
  assert.equal(failedSetup.onboardingStatus, "FAILED");
  assert.ok(failedSetup.onboardingError);
  const schoolId = failedSetup.schoolId!;

  // --- Retry with the database in place ----------------------------------------
  const tenant = new PrismaClient({ datasources: { db: { url: TENANT_URL } } });
  await tenant.user.deleteMany({ where: { email: `principal${EMAIL_DOMAIN}` } });
  await tenant.school.deleteMany({ where: { code: schoolId } });
  const tenantSchool = await tenant.school.create({ data: { code: schoolId, name: "Sandipani Technical Campus", phone: "9405044227" } });
  await tenant.user.create({
    data: {
      schoolId: tenantSchool.id,
      fullName: "Vishal Agrawal",
      email: `principal${EMAIL_DOMAIN}`,
      phone: "9405044227",
      passwordHash: await bcrypt.hash("unknown", 4),
      role: UserRole.PRINCIPAL,
      status: UserStatus.ACTIVE,
      isActive: true
    }
  });
  await masterPrisma.school.create({
    data: {
      schoolId,
      schoolName: "Sandipani Technical Campus",
      ownerName: "Vishal Agrawal",
      email: `principal${EMAIL_DOMAIN}`,
      phone: "9405044227",
      address: "12 Station Road, Indore",
      numberOfStudents: 800,
      numberOfStaff: 45,
      planType: "STANDARD",
      isActive: false,
      dbName: `school_${schoolId}`,
      dbUrl: TENANT_URL
    }
  });

  await rejects(retryOnboarding(asMeena, created.id), "LEAD_NOT_FOUND");
  await retryOnboarding(asRavi, created.id);
  const onboarded = await waitForOnboarding(created.id);
  assert.equal(onboarded.onboardingStatus, "DONE", onboarded.onboardingError ?? "");
  assert.equal(onboarded.stage, "ONBOARDED");

  const invoice = await masterPrisma.invoice.findFirstOrThrow({ where: { schoolId }, include: { payments: true, proforma: true } });
  assert.equal(invoice.status, "PAID");
  assert.equal(invoice.totalMinor, 2360000);
  assert.equal(invoice.taxMinor, 360000);
  assert.equal(invoice.amountPaidMinor, 2360000);
  assert.equal(invoice.proforma?.id, proforma.id);
  assert.equal(invoice.payments.length, 2, "both attempts move onto the school's invoice");
  assert.ok(invoice.payments.every((payment) => payment.schoolId === schoolId));

  const subscription = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
  assert.equal(subscription.status, "ACTIVE");
  assert.equal(subscription.customPriceMinor, 2000000, "the agreed price carries into renewals");
  const school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
  assert.equal(school.isActive, true);
  assert.equal(school.paymentStatus, "PAID");

  const taxPdf = await renderLeadInvoicePdf(asRavi, invoice.id);
  assert.equal(taxPdf.buffer.subarray(0, 4).toString(), "%PDF");
  await rejects(renderLeadInvoicePdf(asMeena, invoice.id), "INVOICE_NOT_FOUND");

  // --- Login details ------------------------------------------------------------
  const login = await issueLoginDetails(created.id, asRavi);
  assert.equal(login.identifier, `principal${EMAIL_DOMAIN}`);
  assert.ok(login.message.includes(schoolId));
  assert.ok(login.message.includes(login.password));
  const principal = await tenant.user.findFirstOrThrow({ where: { email: `principal${EMAIL_DOMAIN}` } });
  assert.ok(await bcrypt.compare(login.password, principal.passwordHash), "the password in the message is the one that works");
  await tenant.$disconnect();

  await rejects(updateLead(asRavi, created.id, { phone: "9000000000" }), "LEAD_ONBOARDED");

  // --- Payments page --------------------------------------------------------------
  const lost = await createLead(ADMIN, {
    schoolName: "Legacy Cosmetic School",
    ownerName: "Anil Mehta",
    email: `legacy${EMAIL_DOMAIN}`,
    phone: "9000012345",
    assignedToId: meena.id
  });
  await issueProforma(asMeena, lost.id, { planCode: PLAN_CODE });
  await updateLead(asMeena, lost.id, { stage: "LOST", lostReason: "Chose another vendor" });

  const from = new Date(Date.now() - 86400000);
  const to = new Date(Date.now() + 86400000);
  const all = await listCrmPayments(ADMIN, { from, to });
  const ours = all.payments.filter((payment) => payment.lead.id === created.id);
  assert.equal(ours.length, 2);
  assert.ok(ours.some((payment) => payment.status === "FAILED"));
  assert.ok(all.summary.collectedMinor >= 2360000);
  assert.ok(all.summary.lostMinor >= 2478000, "the lost lead's proforma counts as lost revenue");

  const meenas = await listCrmPayments(asMeena, { from, to });
  assert.equal(meenas.payments.length, 0, "Meena sees only her own leads' money");
  assert.equal(meenas.summary.lostMinor, 2478000);

  // --- Website enquiries ------------------------------------------------------------
  const enquiry = await createWebsiteLead({
    schoolName: "Hyderabadi Public School",
    ownerName: "Farah Khan",
    email: `hps${EMAIL_DOMAIN}`,
    phone: "9876500000",
    address: "Banjara Hills, Hyderabad",
    numberOfStudents: 300,
    numberOfStaff: 20
  });
  const again = await createWebsiteLead({
    schoolName: "Hyderabadi Public School",
    ownerName: "Farah Khan",
    email: `hps${EMAIL_DOMAIN}`,
    phone: "9876500000"
  });
  assert.equal(again.code, enquiry.code, "a repeat enquiry lands on the same lead");
  const enquiryLead = (await listLeads(ADMIN, { q: enquiry.code })).leads[0];
  assert.equal(enquiryLead.source, "WEBSITE");
  assert.equal(enquiryLead.assignedToId, null);
  const timeline = await getLead(ADMIN, enquiryLead.id);
  assert.ok(timeline.activities.some((activity) => activity.type === "ENQUIRY"));

  await cleanup();
  console.log("crm.test.ts: all assertions passed");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await masterPrisma.$disconnect();
  });
