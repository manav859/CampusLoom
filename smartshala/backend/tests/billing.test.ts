import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AppError } from "../src/core/errors.js";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { signWebhook } from "../src/services/razorpay/index.js";
import {
  confirmCheckout,
  createCheckoutSession,
  getBillingOverview,
  handleRazorpayWebhook,
  mockGatewayPay,
  runSubscriptionMaintenance,
  setCancelAtPeriodEnd
} from "../src/modules/billing/billing.service.js";
import {
  bootstrapSubscription,
  createManualInvoice,
  createPlan,
  getRevenueSummary,
  grantAccess,
  markInvoicePaidOffline,
  refundPayment,
  revokeAccess
} from "../src/modules/billing/billingAdmin.service.js";

/**
 * End-to-end test of the subscription money path against the master database
 * (MASTER_DATABASE_URL). Creates a throwaway school, walks it through the mock
 * Razorpay checkout, and asserts the invoice, payment and subscription all land
 * in the right state. Cleans the school up on the way out.
 *
 *   MASTER_DATABASE_URL=... npm run test:billing
 */

const ACTOR = { kind: "PRINCIPAL" as const, label: "test" };
const usage = { students: 10, staff: 3 };

async function expectAppError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    assert.fail(`Expected AppError ${code}, but the call succeeded`);
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
  }
}

async function main() {
  const schoolId = `T${randomUUID().replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 7)}`;

  await masterPrisma.school.create({
    data: {
      schoolId,
      schoolName: "Billing Test School",
      ownerName: "Test Principal",
      email: `billing-${schoolId.toLowerCase()}@example.test`,
      phone: "9000000000",
      address: "Test address",
      numberOfStudents: 100,
      numberOfStaff: 10,
      planType: "TRIAL",
      isTrial: true,
      isActive: false,
      dbName: `school_${schoolId}`,
      dbUrl: "postgresql://unused/unused"
    }
  });

  try {
    // A paid plan the test owns outright, so it never depends on seed data.
    const planCode = `TESTPLAN${Date.now().toString().slice(-6)}`;
    await createPlan({
      code: planCode,
      name: "Test Yearly",
      priceRupees: 10_000,
      interval: "YEAR",
      isPublic: true,
      sortOrder: 900
    });

    // --- signup ------------------------------------------------------------
    await bootstrapSubscription({ schoolId, planCode: "TRIAL" });
    let overview = await getBillingOverview(schoolId, usage);
    assert.equal(overview.subscription.status, "TRIALING", "signup starts on the trial plan");
    assert.equal(overview.subscription.daysRemaining, 0, "the trial clock does not start before approval");

    // --- super admin approval ----------------------------------------------
    await grantAccess(schoolId);
    overview = await getBillingOverview(schoolId, usage);
    assert.ok(overview.subscription.daysRemaining > 25, "approval starts the 30-day trial");
    let school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isActive, true, "approval mirrors onto School.isActive");

    // --- checkout ------------------------------------------------------------
    const checkout = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    assert.equal(checkout.mode, "MOCK");
    // ₹10,000 + 18% GST
    assert.equal(checkout.amountMinor, 1_180_000, "total is subtotal plus tax");

    // Re-running checkout must reuse the open invoice, not stack duplicates.
    const again = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    assert.equal(again.invoice.id, checkout.invoice.id, "an open invoice is reused");

    // --- a failed attempt ----------------------------------------------------
    const failed = await mockGatewayPay({ orderId: again.orderId, outcome: "failure", method: "card" });
    assert.equal(failed.status, "failed");
    const failedPayment = await masterPrisma.payment.findUniqueOrThrow({
      where: { providerOrderId: again.orderId }
    });
    assert.equal(failedPayment.status, "FAILED");

    // --- a tampered signature is rejected ------------------------------------
    const retry = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    await expectAppError(
      confirmCheckout({
        schoolId,
        payload: {
          razorpay_order_id: retry.orderId,
          razorpay_payment_id: "pay_forged",
          razorpay_signature: "0".repeat(64)
        },
        actor: ACTOR
      }),
      "INVALID_PAYMENT_SIGNATURE"
    );

    // --- the happy path ------------------------------------------------------
    const paid = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    const gateway = await mockGatewayPay({ orderId: paid.orderId, outcome: "success", method: "upi" });
    assert.equal(gateway.status, "success");

    // mockGatewayPay already delivered the webhook, so the invoice is settled
    // before the browser callback lands — exactly the production race.
    const settled = await masterPrisma.invoice.findUniqueOrThrow({ where: { id: paid.invoice.id } });
    assert.equal(settled.status, "PAID", "the webhook alone settles the invoice");

    const confirmed = await confirmCheckout({
      schoolId,
      payload: {
        razorpay_order_id: gateway.razorpay_order_id!,
        razorpay_payment_id: gateway.razorpay_payment_id!,
        razorpay_signature: gateway.razorpay_signature!
      },
      actor: ACTOR
    });
    assert.equal(confirmed.alreadyCaptured, true, "the callback is idempotent after the webhook");
    assert.equal(confirmed.invoice.amountPaidMinor, 1_180_000, "the invoice is not double-credited");

    overview = await getBillingOverview(schoolId, usage);
    assert.equal(overview.subscription.status, "ACTIVE");
    assert.equal(overview.plan.code, planCode, "payment moves the school onto the paid plan");
    assert.ok(overview.subscription.daysRemaining > 360, "a yearly plan buys a year");
    school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isTrial, false);
    assert.equal(school.paymentStatus, "PAID");

    // --- webhook hardening ---------------------------------------------------
    await expectAppError(handleRazorpayWebhook(JSON.stringify({ event: "ping" }), "bad"), "INVALID_WEBHOOK_SIGNATURE");

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: gateway.razorpay_payment_id, order_id: gateway.razorpay_order_id, amount: 1 } } }
    });
    const replay = await handleRazorpayWebhook(body, signWebhook(body));
    assert.equal(replay.status, "duplicate", "a replayed webhook is dropped");

    // --- auto-renew toggle ---------------------------------------------------
    await setCancelAtPeriodEnd(schoolId, true, ACTOR);
    overview = await getBillingOverview(schoolId, usage);
    assert.equal(overview.subscription.cancelAtPeriodEnd, true);
    await setCancelAtPeriodEnd(schoolId, false, ACTOR);

    // --- offline settlement --------------------------------------------------
    // Every checkout above reused the one open invoice, so raise a fresh one.
    const manual = await createManualInvoice({ schoolId, planCode, notes: "Offline settlement test" });
    const offline = await markInvoicePaidOffline({ invoiceId: manual.id, method: "neft", reference: "UTR123" });
    assert.equal(offline.status, "PAID");
    await expectAppError(markInvoicePaidOffline({ invoiceId: manual.id, method: "cash" }), "INVOICE_ALREADY_PAID");

    // --- refund --------------------------------------------------------------
    const capture = await masterPrisma.payment.findFirstOrThrow({
      where: { schoolId, status: "CAPTURED", provider: "razorpay" }
    });
    const refunded = await refundPayment({ paymentId: capture.id, reason: "Test refund" });
    assert.equal(refunded.status, "REFUNDED");
    assert.equal(refunded.refundedMinor, capture.amountMinor);
    await expectAppError(refundPayment({ paymentId: capture.id, reason: "again" }), "PAYMENT_NOT_CAPTURED");

    // --- lifecycle: lapse into grace, then suspend ---------------------------
    const past = new Date(Date.now() - 60_000);
    await masterPrisma.subscription.update({
      where: { schoolId },
      data: { status: "ACTIVE", currentPeriodEnd: past, gracePeriodEndsAt: null }
    });
    await runSubscriptionMaintenance();
    let subscription = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(subscription.status, "PAST_DUE", "a lapsed term goes past due");
    school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isActive, true, "the grace period keeps the school reachable so it can pay");

    await masterPrisma.subscription.update({ where: { schoolId }, data: { gracePeriodEndsAt: past } });
    await runSubscriptionMaintenance();
    subscription = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(subscription.status, "EXPIRED");
    school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isActive, false, "the school is suspended once grace runs out");

    // --- super admin revoke / restore ----------------------------------------
    await grantAccess(schoolId);
    school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isActive, true);
    await revokeAccess(schoolId);
    school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(school.isActive, false);

    // --- summary -------------------------------------------------------------
    const summary = await getRevenueSummary();
    assert.ok(summary.lifetimeCollectedMinor >= 0);
    assert.equal(typeof summary.mrrMinor, "number");

    console.log("billing.test.ts passed");
  } finally {
    await masterPrisma.school.delete({ where: { schoolId } }).catch(() => undefined);
    await masterPrisma.billingEvent.deleteMany({ where: { schoolId } }).catch(() => undefined);
    await masterPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
