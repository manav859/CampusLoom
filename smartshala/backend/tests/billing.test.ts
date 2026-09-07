import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AppError } from "../src/core/errors.js";
import { masterPrisma } from "../src/master-db/masterPrisma.js";
import { markMockOrderPaid, signWebhook } from "../src/services/razorpay/index.js";
import {
  confirmCheckout,
  createCheckoutSession,
  getBillingOverview,
  handleRazorpayWebhook,
  mockGatewayPay,
  renderInvoicePdf,
  runSubscriptionMaintenance,
  setCancelAtPeriodEnd
} from "../src/modules/billing/billing.service.js";
import {
  bootstrapSubscription,
  changeSchoolPlan,
  getSchoolUsage,
  setCustomPrice,
  createCoupon,
  createManualInvoice,
  createPlan,
  getRevenueSummary,
  grantAccess,
  markInvoicePaidOffline,
  refundPayment,
  revokeAccess,
  voidInvoice
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
/**
 * The plan-size guard reads real student and staff counts out of the tenant
 * database, so those assertions only run when one is supplied:
 *   TENANT_DATABASE_URL=postgresql://... npm run test:billing
 */
const TENANT_DB_URL = process.env.TENANT_DATABASE_URL;
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

/** Two active students and one teacher, so the guard has real numbers to read. */
async function seedTenantUsage() {
  const { getTenantPrismaClient } = await import("../src/tenant/prismaManager.js");
  const tenant = getTenantPrismaClient(TENANT_DB_URL!);
  // The tenant database outlives a single run, so start from empty or the
  // counts drift upward every time the test is executed.
  await tenant.school.deleteMany({});
  const school = await tenant.school.create({
    data: { name: "Billing Test Tenant", code: `BT-${randomUUID().slice(0, 8)}` }
  });
  const klass = await tenant.class.create({
    data: { schoolId: school.id, name: "1", section: "A", academicYear: "2026-27" }
  });
  await tenant.student.createMany({
    data: [
      {
        schoolId: school.id,
        classId: klass.id,
        fullName: "Student One",
        admissionNumber: `A-${randomUUID().slice(0, 8)}`,
        parentName: "Parent One",
        parentPhone: "9000000001"
      },
      {
        schoolId: school.id,
        classId: klass.id,
        fullName: "Student Two",
        admissionNumber: `A-${randomUUID().slice(0, 8)}`,
        parentName: "Parent Two",
        parentPhone: "9000000002"
      }
    ]
  });
  await tenant.user.create({
    data: {
      schoolId: school.id,
      fullName: "Test Teacher",
      phone: `9${Date.now().toString().slice(-9)}`,
      passwordHash: "x",
      role: "TEACHER"
    }
  });
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
      dbUrl: TENANT_DB_URL ?? "postgresql://unused/unused"
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

    // --- the invoice as a document -------------------------------------------
    const pdf = await renderInvoicePdf(paid.invoice.id, schoolId);
    assert.equal(pdf.buffer.subarray(0, 5).toString("utf8"), "%PDF-", "an invoice renders as a real PDF");
    assert.ok(pdf.buffer.length > 2000, "the document has content, not just a header");
    assert.equal(pdf.number, paid.invoice.number);
    // One school must never be able to pull another school's invoice.
    await expectAppError(renderInvoicePdf(paid.invoice.id, "OTHERSCH"), "INVOICE_NOT_FOUND");

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

    // Refunding the money must take back the term it bought, or the school
    // keeps a year it no longer paid for.
    const afterRefund = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(afterRefund.status, "PAST_DUE", "a full refund reverses the paid term");
    assert.ok(afterRefund.gracePeriodEndsAt, "the school gets a grace window rather than an instant cut-off");

    // Put the school back on a paid footing for the rest of the test.
    await changeSchoolPlan({ schoolId, planCode, restartPeriod: true, force: true });

    // --- coupon redemptions are released again -------------------------------
    const couponCode = `TESTCPN${Date.now().toString().slice(-6)}`;
    await createCoupon({ code: couponCode, discountType: "PERCENTAGE", discountValue: 10, maxRedemptions: 1 });

    const couponInvoice = await createManualInvoice({ schoolId, planCode, couponCode });
    assert.equal(couponInvoice.discountMinor, 100_000, "10% off INR 10,000");

    await voidInvoice(couponInvoice.id, "Testing coupon release");
    const releasedCoupon = await masterPrisma.coupon.findUniqueOrThrow({ where: { code: couponCode } });
    assert.equal(releasedCoupon.redeemedCount, 0, "voiding an invoice must not burn a capped coupon");

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

    // The school has to hear about it, and hear about it exactly once however
    // often the hourly sweep runs.
    await runSubscriptionMaintenance();
    assert.equal(
      await masterPrisma.billingNotification.count({ where: { schoolId, type: "PAST_DUE" } }),
      1,
      "the past-due warning is sent once, not every hour"
    );

    // Grace about to close: the last warning before suspension.
    await masterPrisma.subscription.update({
      where: { schoolId },
      data: { gracePeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    });
    await runSubscriptionMaintenance();
    assert.equal(
      await masterPrisma.billingNotification.count({ where: { schoolId, type: "GRACE_ENDING" } }),
      1,
      "the school is warned before access is cut off"
    );

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

    // --- negotiated per-school pricing ---------------------------------------
    // Default: every school pays the plan list price.
    let quoted = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    assert.equal(quoted.invoice.subtotalMinor, 1_000_000, "list price by default");

    const custom = await setCustomPrice({ schoolId, priceRupees: 7_500, note: "Multi-year deal" });
    assert.equal(custom.effectivePriceMinor, 750_000);
    assert.equal(custom.listPriceMinor, 1_000_000, "the plan list price is untouched");

    // A new invoice bills at the negotiated rate, tax recalculated on it.
    quoted = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    assert.equal(quoted.invoice.subtotalMinor, 750_000, "custom rate is used for new invoices");
    assert.equal(quoted.amountMinor, 885_000, "INR 7,500 + 18% GST");

    // Only this school moves; the plan and everyone else are unaffected.
    const planRow = await masterPrisma.plan.findUniqueOrThrow({ where: { code: planCode } });
    assert.equal(planRow.priceMinor, 1_000_000, "custom pricing must not edit the plan");

    // The principal sees their real price, not the list price.
    overview = await getBillingOverview(schoolId, usage);
    assert.equal(overview.pricing.effectivePriceMinor, 750_000);
    assert.equal(overview.pricing.isCustomPrice, true);

    // Clearing returns the school to list price.
    const cleared = await setCustomPrice({ schoolId, priceRupees: null });
    assert.equal(cleared.effectivePriceMinor, 1_000_000);
    overview = await getBillingOverview(schoolId, usage);
    assert.equal(overview.pricing.isCustomPrice, false);

    // A plan change clears a stale override unless one is passed explicitly.
    await setCustomPrice({ schoolId, priceRupees: 7_500 });
    await changeSchoolPlan({ schoolId, planCode, restartPeriod: true, force: true });
    let sub = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(sub.customPriceMinor, null, "plan change resets to list price by default");

    await changeSchoolPlan({ schoolId, planCode, restartPeriod: true, customPriceRupees: 6_000, force: true });
    sub = await masterPrisma.subscription.findUniqueOrThrow({ where: { schoolId } });
    assert.equal(sub.customPriceMinor, 600_000, "a rate passed with the plan change is kept");
    await setCustomPrice({ schoolId, priceRupees: null });

    // --- downgrade guard -----------------------------------------------------
    const smallCode = `TINY${Date.now().toString().slice(-6)}`;
    await createPlan({ code: smallCode, name: "Tiny", priceRupees: 1_000, interval: "YEAR", maxStudents: 1, sortOrder: 901 });

    if (TENANT_DB_URL) {
      await seedTenantUsage();
      const seen = await getSchoolUsage(schoolId);
      assert.equal(seen.reachable, true, "tenant database should be readable");
      assert.equal(seen.students, 2, "usage is read from the tenant database");

      await expectAppError(
        changeSchoolPlan({ schoolId, planCode: smallCode, restartPeriod: true }),
        "PLAN_TOO_SMALL"
      );
      // Forcing it through is allowed, because sometimes the deal is the deal.
      await changeSchoolPlan({ schoolId, planCode: smallCode, restartPeriod: true, force: true });
      await changeSchoolPlan({ schoolId, planCode, restartPeriod: true, force: true });
    } else {
      console.warn("TENANT_DATABASE_URL not set - skipping the plan-size guard assertions");
    }

    // --- reconciliation of a lost payment ------------------------------------
    // The dangerous case: money left the school's account, but the webhook
    // never arrived and the browser closed before the callback. The order must
    // be recovered from the gateway, never written off as abandoned.
    const lost = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    const lostPaymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    markMockOrderPaid(lost.orderId, lostPaymentId, "upi");

    // Age the order past the reconciliation window without touching the gateway.
    await masterPrisma.payment.update({
      where: { providerOrderId: lost.orderId },
      data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) }
    });

    const sweep = await runSubscriptionMaintenance();
    assert.equal(sweep.recoveredPayments, 1, "a paid-but-unnotified order is recovered");
    assert.equal(sweep.abandonedPayments, 0, "a real payment is never marked abandoned");

    const recovered = await masterPrisma.payment.findUniqueOrThrow({ where: { providerOrderId: lost.orderId } });
    assert.equal(recovered.status, "CAPTURED");
    assert.equal(recovered.providerPaymentId, lostPaymentId);
    const recoveredInvoice = await masterPrisma.invoice.findUniqueOrThrow({ where: { id: lost.invoice.id } });
    assert.equal(recoveredInvoice.status, "PAID", "reconciliation settles the invoice");

    // An order the gateway never saw paid is written off instead.
    const dead = await createCheckoutSession({ schoolId, planCode, actor: ACTOR });
    await masterPrisma.payment.update({
      where: { providerOrderId: dead.orderId },
      data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    const sweep2 = await runSubscriptionMaintenance();
    assert.equal(sweep2.abandonedPayments, 1, "a genuinely abandoned checkout is retired");
    const deadPayment = await masterPrisma.payment.findUniqueOrThrow({ where: { providerOrderId: dead.orderId } });
    assert.equal(deadPayment.status, "FAILED");

    // --- notifications --------------------------------------------------------
    // Every money event the school could be blindsided by has to have been sent.
    const notifications = await masterPrisma.billingNotification.findMany({ where: { schoolId } });
    const sentTypes = new Set(notifications.map((notification) => notification.type));
    for (const expected of ["PAYMENT_RECEIVED", "PAYMENT_FAILED", "INVOICE_RAISED", "PAST_DUE", "GRACE_ENDING", "SUSPENDED"]) {
      assert.ok(sentTypes.has(expected as never), `${expected} notification was never sent`);
    }
    assert.ok(
      notifications.every((notification) => notification.status === "SENT"),
      "no billing notification should be left failed or skipped for a school with a phone number"
    );

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
