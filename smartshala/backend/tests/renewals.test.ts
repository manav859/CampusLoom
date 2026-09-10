import assert from "node:assert/strict";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { listRenewals, renewSubscription } from "../src/modules/billing/billingAdmin.service.js";
import { getPaymentLinkView } from "../src/modules/billing/paymentLinks.service.js";

/**
 * Integration test for the super admin renewal desk: the renewals list and the
 * one-step renew. Requires a reachable master database (MASTER_DATABASE_URL).
 * Creates an isolated school and deletes it at the end.
 */
const SCHOOL_ID = "RNTEST01";
const DAY_MS = 86_400_000;

async function cleanup() {
  await masterPrisma.school.deleteMany({ where: { schoolId: SCHOOL_ID } });
  await masterPrisma.plan.deleteMany({ where: { code: "RNSTART" } });
}

async function seed() {
  const plan = await masterPrisma.plan.create({
    data: { code: "RNSTART", name: "Renewal Test Starter", priceMinor: 2400000, interval: "YEAR", intervalCount: 1 }
  });
  await masterPrisma.school.create({
    data: {
      schoolId: SCHOOL_ID,
      schoolName: "Renewal Test School",
      ownerName: "Test Owner",
      email: "owner@example.test",
      phone: "0000000000",
      address: "1 Test Road, Ahmedabad, Gujarat 380001",
      numberOfStudents: 100,
      numberOfStaff: 10,
      planType: "STANDARD",
      dbName: `db_${SCHOOL_ID.toLowerCase()}`,
      dbUrl: "postgresql://unused"
    }
  });
  const termEnd = new Date(Date.now() + 5 * DAY_MS);
  await masterPrisma.subscription.create({
    data: {
      schoolId: SCHOOL_ID,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(termEnd.getTime() - 365 * DAY_MS),
      currentPeriodEnd: termEnd
    }
  });
  return { termEnd };
}

const findRow = async () => (await listRenewals(30)).find((row) => row.schoolId === SCHOOL_ID);

async function main() {
  await cleanup();
  const { termEnd } = await seed();

  // A term ending in five days is on the desk, not yet billed.
  const due = await findRow();
  assert.ok(due, "a term ending within 30 days is listed");
  assert.ok(due.daysLeft >= 4 && due.daysLeft <= 5, `daysLeft was ${due.daysLeft}`);
  assert.equal(due.openInvoice, null);
  assert.equal(due.effectivePriceMinor, 2400000);
  console.log("listed:", due.school.schoolName, `${due.daysLeft} days left`);

  // Renew with a payment link at list price.
  const linked = await renewSubscription({ schoolId: SCHOOL_ID, planCode: "RNSTART", priceRupees: 24000, collect: "PAYMENT_LINK" });
  assert.equal(linked.invoice.status, "DUE");
  assert.equal(linked.reusedInvoice, false);
  assert.ok(linked.paymentLink, "a payment link was issued");
  assert.equal(linked.invoice.periodStart.getTime(), termEnd.getTime(), "the new term starts where the old one ends");
  assert.equal((await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId: SCHOOL_ID } })).customPriceMinor, null);

  const billed = await findRow();
  assert.equal(billed?.openInvoice?.id, linked.invoice.id);
  assert.equal(billed?.paymentLink?.id, linked.paymentLink.id);
  console.log("renewed with link:", linked.invoice.number);

  // Renewing again on the same terms reuses that invoice instead of stacking one.
  const again = await renewSubscription({ schoolId: SCHOOL_ID, planCode: "RNSTART", priceRupees: 24000, collect: "INVOICE_ONLY" });
  assert.equal(again.reusedInvoice, true);
  assert.equal(again.invoice.id, linked.invoice.id);
  assert.deepEqual(again.supersededInvoices, []);
  console.log("same terms reuse the open invoice");

  // A negotiated price paid offline: new invoice, old one and its link retired.
  const offline = await renewSubscription({
    schoolId: SCHOOL_ID,
    planCode: "RNSTART",
    priceRupees: 20000,
    collect: "PAID_OFFLINE",
    offlineMethod: "neft",
    offlineReference: "UTR-TEST-1"
  });
  assert.equal(offline.reusedInvoice, false);
  assert.equal(offline.invoice.status, "PAID");
  assert.equal(offline.invoice.subtotalMinor, 2000000, "invoice charges the agreed price");
  assert.deepEqual(offline.supersededInvoices, [linked.invoice.number]);

  const oldInvoice = await masterPrisma.invoice.findUniqueOrThrow({ where: { id: linked.invoice.id } });
  assert.equal(oldInvoice.status, "VOID", "the superseded invoice is voided");
  await assert.rejects(() => getPaymentLinkView(linked.paymentLink!.token), /cancelled/i, "its link no longer works");

  const renewed = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId: SCHOOL_ID } });
  assert.equal(renewed.status, "ACTIVE");
  assert.equal(renewed.customPriceMinor, 2000000, "the agreed price sticks for future renewals");
  assert.equal(renewed.currentPeriodEnd.getTime(), offline.invoice.periodEnd.getTime());
  console.log("paid offline at ₹20,000; old invoice voided, link revoked");

  // Renewed a year out, the school leaves the desk.
  assert.equal(await findRow(), undefined);
  console.log("school no longer due");

  await cleanup();
  console.log("\nAll renewal checks passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup().catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => masterPrisma.$disconnect());
