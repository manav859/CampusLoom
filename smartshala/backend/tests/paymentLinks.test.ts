import assert from "node:assert/strict";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { renderInvoicePdf, type BillingActor } from "../src/modules/billing/billing.service.js";
import {
  confirmPaymentLinkPayment,
  createPaymentLink,
  getPaymentLinkView,
  listPaymentLinks,
  payPaymentLinkViaMockGateway,
  revokePaymentLink,
  startPaymentLinkCheckout
} from "../src/modules/billing/paymentLinks.service.js";

/**
 * Integration test for the shareable payment links a super admin sends to a
 * school. Requires a reachable master database (MASTER_DATABASE_URL) and the
 * mock gateway (RAZORPAY_MODE unset or "mock"). Creates an isolated school and
 * deletes it at the end.
 */
const SCHOOL_ID = "PLTEST01";
const ACTOR: BillingActor = { kind: "SUPER_ADMIN", label: "test" };

async function cleanup() {
  await masterPrisma.school.deleteMany({ where: { schoolId: SCHOOL_ID } });
  await masterPrisma.plan.deleteMany({ where: { code: "PLTEST" } });
}

async function seed() {
  const plan = await masterPrisma.plan.create({
    data: { code: "PLTEST", name: "Link Test Annual", priceMinor: 1200000, interval: "YEAR", intervalCount: 1 }
  });

  await masterPrisma.school.create({
    data: {
      schoolId: SCHOOL_ID,
      schoolName: "Payment Link Test School",
      ownerName: "Test Owner",
      email: "owner@example.test",
      phone: "9999900000",
      address: "1 Test Road, Ahmedabad, Gujarat 380001",
      gstin: "24AABCS1429B1ZP",
      stateName: "Gujarat",
      stateCode: "24",
      numberOfStudents: 100,
      numberOfStaff: 10,
      planType: "STANDARD",
      dbName: `db_${SCHOOL_ID.toLowerCase()}`,
      dbUrl: "postgresql://unused"
    }
  });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 365 * 86400000);
  const subscription = await masterPrisma.subscription.create({
    data: {
      schoolId: SCHOOL_ID,
      planId: plan.id,
      status: "PAST_DUE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd
    }
  });

  const invoice = await masterPrisma.invoice.create({
    data: {
      number: `PLTEST-${Date.now()}`,
      schoolId: SCHOOL_ID,
      subscriptionId: subscription.id,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      status: "DUE",
      subtotalMinor: 1200000,
      taxMinor: 216000,
      totalMinor: 1416000,
      periodStart: now,
      periodEnd,
      dueAt: new Date(now.getTime() + 7 * 86400000)
    }
  });

  return { plan, invoice };
}

async function main() {
  await cleanup();
  const { invoice } = await seed();

  const link = await createPaymentLink({ invoiceId: invoice.id, note: "Renewal for 2026-27", actor: ACTOR });
  assert.match(link.token, /^[a-f0-9]{64}$/);
  assert.equal(link.amountMinor, 1416000);
  assert.equal(link.status, "ACTIVE");
  assert.ok(link.url.endsWith(`/pay/${link.token}`));
  console.log("link created:", link.url);

  const view = await getPaymentLinkView(link.token);
  assert.equal(view.state, "PAYABLE");
  assert.equal(view.invoice.amountDueMinor, 1416000);
  assert.equal(view.note, "Renewal for 2026-27");
  assert.equal(view.school.schoolName, "Payment Link Test School");
  // The link is unauthenticated, so the public view must stay narrow.
  assert.ok(!("email" in view.school));

  const session = await startPaymentLinkCheckout(link.token);
  assert.equal(session.mode, "MOCK");
  assert.equal(session.amountMinor, 1416000);

  // Opening the page twice must reuse the gateway order, not stack a second one.
  const reopened = await startPaymentLinkCheckout(link.token);
  assert.equal(reopened.orderId, session.orderId);
  assert.equal(await masterPrisma.payment.count({ where: { invoiceId: invoice.id } }), 1);

  const paid = await payPaymentLinkViaMockGateway({
    token: link.token,
    orderId: session.orderId,
    outcome: "success",
    method: "upi"
  });
  assert.equal(paid.status, "success");
  assert.ok("razorpay_signature" in paid);

  const confirmed = await confirmPaymentLinkPayment(link.token, {
    razorpay_order_id: paid.razorpay_order_id!,
    razorpay_payment_id: paid.razorpay_payment_id!,
    razorpay_signature: paid.razorpay_signature!
  });
  assert.equal(confirmed.status, "PAID");

  const settledInvoice = await masterPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(settledInvoice.status, "PAID");
  assert.equal(settledInvoice.amountPaidMinor, 1416000);

  const settledLink = await masterPrisma.paymentLink.findUniqueOrThrow({ where: { id: link.id } });
  assert.equal(settledLink.status, "PAID");
  assert.ok(settledLink.firstViewedAt);

  const settledSub = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId: SCHOOL_ID } });
  assert.equal(settledSub.status, "ACTIVE");

  assert.equal((await getPaymentLinkView(link.token)).state, "PAID");
  await assert.rejects(() => startPaymentLinkCheckout(link.token), /already settled/i);
  console.log("invoice settled, subscription reactivated, link closed");

  // A second link on the same invoice supersedes the first.
  const second = await masterPrisma.invoice.create({
    data: {
      number: `PLTEST2-${Date.now()}`,
      schoolId: SCHOOL_ID,
      planCode: "PLTEST",
      planName: "Link Test Annual",
      status: "DUE",
      subtotalMinor: 100000,
      taxMinor: 18000,
      totalMinor: 118000,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 86400000),
      dueAt: new Date(Date.now() + 86400000)
    }
  });

  const linkA = await createPaymentLink({ invoiceId: second.id, actor: ACTOR });
  const linkB = await createPaymentLink({ invoiceId: second.id, actor: ACTOR });
  assert.equal((await masterPrisma.paymentLink.findUniqueOrThrow({ where: { id: linkA.id } })).status, "REVOKED");
  await assert.rejects(() => getPaymentLinkView(linkA.token), /cancelled/i);

  await revokePaymentLink(linkB.id, ACTOR);
  await assert.rejects(() => getPaymentLinkView(linkB.token), /cancelled/i);
  await assert.rejects(() => getPaymentLinkView("0".repeat(64)), /not valid/i);
  assert.equal((await listPaymentLinks({ schoolId: SCHOOL_ID })).length, 3);
  console.log("re-issue, revoke and unknown-token all behave");

  const pdf = await renderInvoicePdf(settledInvoice.id);
  assert.ok(pdf.buffer.length > 2000);
  assert.equal(pdf.number, settledInvoice.number);
  console.log("tax invoice rendered:", pdf.buffer.length, "bytes");

  await cleanup();
  console.log("\nAll payment-link checks passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup().catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => masterPrisma.$disconnect());
