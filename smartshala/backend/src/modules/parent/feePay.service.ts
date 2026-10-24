import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { FeeComponent, PaymentMode, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError, notFound } from "../../core/errors.js";
import { resolveTenant } from "../../tenant/tenantResolver.js";
import { getTenantPrismaClient } from "../../tenant/prismaManager.js";
import { runWithTenant } from "../../tenant/tenantContext.js";
import { razorpay, markMockOrderPaid, assertMockGateway, signCheckout } from "../../services/razorpay/index.js";
import type { CheckoutSignature } from "../../services/razorpay/index.js";
import { collectPayment } from "../fees/fees.service.js";

/**
 * Online student-fee payment, from the Parent app. A parent has no User row and
 * student fees live in the tenant DB (not the master billing schema), so this
 * flow is deliberately stateless: a short-lived signed token is the whole
 * credential the public pay page carries, and the Razorpay order's `notes` carry
 * the same facts to the webhook. The one durable record is the tenant `Payment`
 * row written on settlement; its unique `gatewayTransactionId` makes the confirm
 * callback and the webhook safe to both arrive (idempotent settlement).
 */

const TOKEN_TTL = "30m";
const TOKEN_TYPE = "fee_pay";

/** The system user that owns parent-initiated online payments, one per school. */
const ONLINE_USER_EMAIL = "online-payments@parent.smartshala.local";
const ONLINE_USER_PHONE = "00000000000000";

type FeePayClaims = {
  typ: typeof TOKEN_TYPE;
  sid: string; // school row uuid (tenant DB)
  tsid: string; // tenant school code (SS000001), for routing
  stu: string; // student uuid
  asg: string; // fee assignment uuid
  amt: number; // amount in minor units, locked at mint
  cur: string;
};

export function signFeePayToken(claims: Omit<FeePayClaims, "typ">) {
  return jwt.sign({ ...claims, typ: TOKEN_TYPE }, env.JWT_ACCESS_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyFeePayToken(token: string): FeePayClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError(401, "This payment link is no longer valid", "FEE_PAY_TOKEN_INVALID");
  }
  const claims = decoded as Partial<FeePayClaims>;
  if (claims?.typ !== TOKEN_TYPE || !claims.sid || !claims.tsid || !claims.stu || !claims.asg || !claims.amt) {
    throw new AppError(401, "This payment link is not valid", "FEE_PAY_TOKEN_INVALID");
  }
  return claims as FeePayClaims;
}

/** Resolve the tenant client for a school code and run `fn` scoped to it. */
async function withTenant<T>(
  tenantSchoolId: string,
  fn: (client: PrismaClient, tenant: { schoolName: string }) => Promise<T>
) {
  const tenant = await resolveTenant(tenantSchoolId, { allowSuspended: true });
  const client = getTenantPrismaClient(tenant.dbUrl);
  return runWithTenant(
    { schoolId: tenant.schoolId, schoolName: tenant.schoolName, dbName: tenant.dbName, prisma: client },
    () => fn(client, { schoolName: tenant.schoolName })
  );
}

/**
 * Find or create the per-school "Online Payment" user. It is inactive (so it
 * never appears in staff lists, which filter on isActive) and unable to sign in
 * (its password hash is random, not a bcrypt hash), yet it is a valid FK for
 * `Payment.recordedById` and renders cleanly on receipts.
 */
async function getOnlinePaymentUser(client: PrismaClient, schoolUuid: string) {
  const existing = await client.user.findFirst({
    where: { schoolId: schoolUuid, email: ONLINE_USER_EMAIL },
    select: { id: true }
  });
  if (existing) return existing;

  try {
    return await client.user.create({
      data: {
        schoolId: schoolUuid,
        fullName: "Online Payment (Parent App)",
        email: ONLINE_USER_EMAIL,
        phone: ONLINE_USER_PHONE,
        passwordHash: crypto.randomBytes(24).toString("hex"),
        role: UserRole.ACCOUNTANT,
        isActive: false
      },
      select: { id: true }
    });
  } catch {
    // A racing settlement created it first; re-read.
    const now = await client.user.findFirst({
      where: { schoolId: schoolUuid, email: ONLINE_USER_EMAIL },
      select: { id: true }
    });
    if (!now) throw new AppError(500, "Could not prepare the payment account", "FEE_PAY_USER_FAILED");
    return now;
  }
}

/**
 * Record a successful online payment against a student's fee assignment. Called
 * from the confirm callback (with the token's facts) and from the webhook (with
 * the order's `notes`). Safe to call twice for the same Razorpay payment.
 */
export async function settleStudentFeeOnline(args: {
  tenantSchoolId: string;
  schoolUuid: string;
  studentId: string;
  assignmentId: string;
  amountMinor: number;
  providerPaymentId: string;
}): Promise<{ receiptNo: string | null; alreadySettled: boolean }> {
  return withTenant(args.tenantSchoolId, async (client) => {
    const assignment = await client.studentFeeAssignment.findFirst({
      where: { id: args.assignmentId, schoolId: args.schoolUuid, studentId: args.studentId },
      select: { pendingAmount: true }
    });
    if (!assignment) throw notFound("Fee assignment");

    // Never record more than what is still outstanding — a partial payment made
    // elsewhere between mint and settlement must not be over-collected.
    const pending = Number(assignment.pendingAmount);
    const amount = Math.min(args.amountMinor / 100, pending);
    if (amount <= 0) return { receiptNo: null, alreadySettled: true };

    const recorder = await getOnlinePaymentUser(client, args.schoolUuid);
    const user: Express.UserContext = {
      id: recorder.id,
      schoolId: args.schoolUuid,
      tenantSchoolId: args.tenantSchoolId,
      role: UserRole.ACCOUNTANT,
      fullName: "Online Payment (Parent App)"
    };

    try {
      const result = await collectPayment(user, {
        studentId: args.studentId,
        assignmentId: args.assignmentId,
        amount,
        feeComponent: FeeComponent.SCHOOL_FEE,
        mode: PaymentMode.ONLINE_GATEWAY,
        gatewayTransactionId: args.providerPaymentId,
        sendReceiptOnWhatsApp: false,
        notes: "Paid online via the Parent app"
      });
      return { receiptNo: result.receipt.receiptNo, alreadySettled: false };
    } catch (error) {
      // The confirm callback and the webhook race; whichever lands second hits
      // the unique gatewayTransactionId and is treated as a no-op success.
      if (error instanceof AppError && error.code === "DUPLICATE_GATEWAY_TRANSACTION") {
        return { receiptNo: null, alreadySettled: true };
      }
      throw error;
    }
  });
}

// --- Public pay page (token-authenticated) -----------------------------------

/** What the pay page shows before anyone pays: who, what, and how much is due. */
export async function viewFeePayment(token: string) {
  const claims = verifyFeePayToken(token);
  return withTenant(claims.tsid, async (client, tenant) => {
    const assignment = await client.studentFeeAssignment.findFirst({
      where: { id: claims.asg, schoolId: claims.sid, studentId: claims.stu },
      select: {
        pendingAmount: true,
        feeStructure: { select: { name: true } },
        student: { select: { fullName: true, admissionNumber: true } }
      }
    });
    if (!assignment) throw notFound("Fee assignment");

    const amountDueMinor = Math.max(0, Math.round(Number(assignment.pendingAmount) * 100));
    return {
      state: amountDueMinor <= 0 ? ("PAID" as const) : ("PAYABLE" as const),
      currency: claims.cur,
      amountDueMinor,
      student: { name: assignment.student.fullName, admissionNumber: assignment.student.admissionNumber },
      school: { name: tenant.schoolName, schoolId: claims.tsid },
      fee: { name: assignment.feeStructure.name },
      seller: { name: env.BILLING_SELLER_NAME }
    };
  });
}

/** Create (or re-create) the Razorpay order the page pays against. */
export async function startFeePaymentCheckout(token: string) {
  const claims = verifyFeePayToken(token);
  return withTenant(claims.tsid, async (client) => {
    const assignment = await client.studentFeeAssignment.findFirst({
      where: { id: claims.asg, schoolId: claims.sid, studentId: claims.stu },
      select: {
        pendingAmount: true,
        feeStructure: { select: { name: true } },
        student: { select: { fullName: true, admissionNumber: true, parentPhone: true } }
      }
    });
    if (!assignment) throw notFound("Fee assignment");

    const amountMinor = Math.min(claims.amt, Math.round(Number(assignment.pendingAmount) * 100));
    if (amountMinor <= 0) throw new AppError(409, "These fees are already paid", "FEE_ALREADY_PAID");

    const order = await razorpay.createOrder({
      amountMinor,
      currency: claims.cur,
      receipt: assignment.student.admissionNumber ?? claims.stu,
      notes: {
        kind: "STUDENT_FEE",
        schoolUuid: claims.sid,
        tenantSchoolId: claims.tsid,
        studentId: claims.stu,
        assignmentId: claims.asg,
        amountMinor: String(amountMinor)
      }
    });

    return {
      mode: razorpay.mode,
      keyId: razorpay.keyId,
      orderId: order.id,
      amountMinor,
      currency: claims.cur,
      student: { name: assignment.student.fullName },
      fee: { name: assignment.feeStructure.name },
      prefill: { name: assignment.student.fullName, contact: assignment.student.parentPhone ?? "" },
      seller: { name: env.BILLING_SELLER_NAME }
    };
  });
}

/** The browser callback after a Razorpay payment — verify the signature, settle. */
export async function confirmFeePayment(token: string, payload: CheckoutSignature) {
  const claims = verifyFeePayToken(token);

  if (!razorpay.verifyCheckoutSignature(payload)) {
    throw new AppError(400, "Payment signature could not be verified", "INVALID_PAYMENT_SIGNATURE");
  }

  const result = await settleStudentFeeOnline({
    tenantSchoolId: claims.tsid,
    schoolUuid: claims.sid,
    studentId: claims.stu,
    assignmentId: claims.asg,
    amountMinor: claims.amt,
    providerPaymentId: payload.razorpay_payment_id
  });

  return { status: "PAID" as const, receiptNo: result.receiptNo };
}

/** Mock gateway only — stands in for Razorpay's servers during testing. */
export async function payFeePaymentViaMockGateway(input: {
  token: string;
  orderId: string;
  outcome: "success" | "failure";
  method: string;
}) {
  assertMockGateway();
  verifyFeePayToken(input.token); // reject a tampered/expired token before paying

  if (input.outcome === "failure") {
    return { status: "failed" as const, reason: "Payment declined at the (mock) gateway" };
  }

  const razorpayPaymentId = `pay_${crypto.randomBytes(9).toString("hex").slice(0, 14)}`;
  markMockOrderPaid(input.orderId, razorpayPaymentId, input.method);

  return {
    status: "success" as const,
    razorpay_order_id: input.orderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: signCheckout(input.orderId, razorpayPaymentId)
  };
}

/** Settle from a webhook `payment.captured` whose order was a student fee. */
export async function settleStudentFeeFromWebhook(notes: Record<string, string>, providerPaymentId: string) {
  const amountMinor = Number(notes.amountMinor);
  if (!notes.tenantSchoolId || !notes.schoolUuid || !notes.studentId || !notes.assignmentId || !Number.isFinite(amountMinor)) {
    logger.warn({ notes }, "Student-fee webhook missing order notes; skipping");
    return;
  }
  await settleStudentFeeOnline({
    tenantSchoolId: notes.tenantSchoolId,
    schoolUuid: notes.schoolUuid,
    studentId: notes.studentId,
    assignmentId: notes.assignmentId,
    amountMinor,
    providerPaymentId
  });
}
