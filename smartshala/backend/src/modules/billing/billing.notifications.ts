import {
  BillingNotificationStatus,
  BillingNotificationType,
  Prisma
} from "../../../node_modules/@smartshala/master-client/index.js";
import type { Invoice, School, Subscription } from "../../../node_modules/@smartshala/master-client/index.js";
import { logger } from "../../config/logger.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { WhatsAppCloudProvider } from "../notifications/whatsapp.service.js";
import { rupeesFromMinor } from "./billing.pricing.js";

/**
 * Billing messages to the school: invoice raised, payment received or failed,
 * renewal due, past due, grace ending, suspended.
 *
 * Two rules hold everywhere in this file:
 *  - a notification never breaks the money path, so every entry point swallows
 *    its own errors and only logs;
 *  - every message is written to `billing_notifications` before it can be sent
 *    twice, because the maintenance sweep runs hourly over the same rows.
 */

const provider = new WhatsAppCloudProvider();

function formatMoney(minor: number, currency: string) {
  const prefix = currency === "INR" ? "Rs." : currency;
  return `${prefix} ${rupeesFromMinor(minor).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

type Notification = {
  schoolId: string;
  type: BillingNotificationType;
  /** Identifies the subject — an invoice id, a period end. Never a timestamp. */
  dedupeKey: string;
  build: (school: School) => string;
};

/**
 * Sends one message, at most once per (school, type, subject), and records the
 * attempt either way. Returns null when the message was already sent.
 */
async function dispatch(input: Notification) {
  const key = { schoolId: input.schoolId, type: input.type, dedupeKey: input.dedupeKey };

  const already = await masterPrisma.billingNotification.findUnique({
    where: { schoolId_type_dedupeKey: key }
  });
  if (already) return null;

  const school = await masterPrisma.school.findUnique({ where: { schoolId: input.schoolId } });
  if (!school) return null;

  const message = input.build(school);
  const recipient = school.phone?.trim() ?? "";

  let status: BillingNotificationStatus = BillingNotificationStatus.SENT;
  let error: string | null = null;

  if (!recipient) {
    status = BillingNotificationStatus.SKIPPED;
    error = "No billing contact number on record for this school";
  } else {
    try {
      await provider.send({ to: recipient, message });
    } catch (err) {
      status = BillingNotificationStatus.FAILED;
      error = err instanceof Error ? err.message : "Unknown provider error";
    }
  }

  try {
    return await masterPrisma.billingNotification.create({
      data: {
        ...key,
        recipient,
        message,
        status,
        error,
        sentAt: status === BillingNotificationStatus.SENT ? new Date() : null
      }
    });
  } catch (err) {
    // Another worker won the race on the unique key; its row is the record.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

/** Wraps a dispatch so a messaging failure can never fail a billing action. */
async function safely(action: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (err) {
    logger.error({ err, action }, "Billing notification failed");
  }
}

// --- Entry points ------------------------------------------------------------

/** A new invoice the school has to act on: raised by the super admin, or a renewal. */
export async function notifyInvoiceRaised(invoice: Invoice, options: { renewal: boolean }) {
  await safely("invoice.raised", () =>
    dispatch({
      schoolId: invoice.schoolId,
      type: options.renewal ? BillingNotificationType.RENEWAL_UPCOMING : BillingNotificationType.INVOICE_RAISED,
      dedupeKey: invoice.id,
      build: (school) =>
        options.renewal
          ? `${school.schoolName}: your SmartShala ${invoice.planName} subscription renews on ${formatDate(invoice.periodStart)}. Invoice ${invoice.number} for ${formatMoney(invoice.totalMinor, invoice.currency)} is due by ${formatDate(invoice.dueAt)}. Pay from Settings > Subscription.`
          : `${school.schoolName}: invoice ${invoice.number} for ${formatMoney(invoice.totalMinor, invoice.currency)} (${invoice.planName}) has been raised and is due by ${formatDate(invoice.dueAt)}. Pay from Settings > Subscription.`
    })
  );
}

export async function notifyPaymentReceived(invoice: Invoice, amountMinor: number) {
  await safely("payment.received", () =>
    dispatch({
      schoolId: invoice.schoolId,
      type: BillingNotificationType.PAYMENT_RECEIVED,
      dedupeKey: invoice.id,
      build: (school) =>
        `${school.schoolName}: we have received ${formatMoney(amountMinor, invoice.currency)} against invoice ${invoice.number}. Your ${invoice.planName} subscription is active until ${formatDate(invoice.periodEnd)}. Thank you.`
    })
  );
}

export async function notifyPaymentFailed(input: {
  schoolId: string;
  invoiceNumber: string;
  providerOrderId: string;
  reason: string;
}) {
  await safely("payment.failed", () =>
    dispatch({
      schoolId: input.schoolId,
      type: BillingNotificationType.PAYMENT_FAILED,
      dedupeKey: input.providerOrderId,
      build: (school) =>
        `${school.schoolName}: your payment attempt for invoice ${input.invoiceNumber} did not go through (${input.reason}). No amount has been charged. Please try again from Settings > Subscription.`
    })
  );
}

type SubscriptionForNotice = Subscription & { plan: { name: string } };

export async function notifyPastDue(subscription: SubscriptionForNotice) {
  await safely("subscription.past_due", () =>
    dispatch({
      schoolId: subscription.schoolId,
      type: BillingNotificationType.PAST_DUE,
      dedupeKey: subscription.currentPeriodEnd.toISOString(),
      build: (school) =>
        `${school.schoolName}: your SmartShala ${subscription.plan.name} subscription ended on ${formatDate(subscription.currentPeriodEnd)} and payment is pending.${
          subscription.gracePeriodEndsAt
            ? ` Your account stays open until ${formatDate(subscription.gracePeriodEndsAt)}.`
            : ""
        } Please pay from Settings > Subscription to avoid interruption.`
    })
  );
}

export async function notifyGraceEnding(subscription: SubscriptionForNotice) {
  if (!subscription.gracePeriodEndsAt) return;
  const graceEnd = subscription.gracePeriodEndsAt;
  await safely("subscription.grace_ending", () =>
    dispatch({
      schoolId: subscription.schoolId,
      type: BillingNotificationType.GRACE_ENDING,
      dedupeKey: graceEnd.toISOString(),
      build: (school) =>
        `${school.schoolName}: this is a final reminder — SmartShala access will be suspended on ${formatDate(graceEnd)} unless the pending subscription payment is completed. Your data is retained; access resumes as soon as you pay.`
    })
  );
}

export async function notifySuspended(subscription: SubscriptionForNotice) {
  await safely("subscription.expired", () =>
    dispatch({
      schoolId: subscription.schoolId,
      type: BillingNotificationType.SUSPENDED,
      dedupeKey: subscription.currentPeriodEnd.toISOString(),
      build: (school) =>
        `${school.schoolName}: SmartShala access has been suspended because the subscription payment is still pending. Your data is safe. Please contact SmartShala support or pay the outstanding invoice to restore access.`
    })
  );
}

export async function listSchoolNotifications(schoolId: string, take = 25) {
  return masterPrisma.billingNotification.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take
  });
}
