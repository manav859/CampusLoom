import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../core/asyncHandler.js";
import { AppError } from "../../core/errors.js";
import { prisma } from "../../core/prisma.js";
import { assertMockGateway, razorpay } from "../../services/razorpay/index.js";
import { quotePlan } from "./billing.pricing.js";
import {
  confirmCheckout,
  createCheckoutSession,
  getBillingOverview,
  getInvoice,
  getPlanByCodeOrThrow,
  listInvoices,
  listPlans,
  mockGatewayPay,
  setCancelAtPeriodEnd
} from "./billing.service.js";
import type { BillingActor } from "./billing.service.js";

/** The master-DB school id (SS-style code), not the tenant-local UUID. */
function tenantSchoolId(req: Request) {
  const schoolId = req.tenant?.schoolId ?? req.user?.tenantSchoolId;
  if (!schoolId) {
    throw new AppError(400, "Open billing from your school workspace URL", "TENANT_CONTEXT_REQUIRED");
  }
  return schoolId;
}

function actorFrom(req: Request): BillingActor {
  return { kind: "PRINCIPAL", label: req.user?.id ?? "unknown" };
}

const STAFF_ROLES = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT];

async function currentUsage() {
  const [students, staff] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, role: { in: STAFF_ROLES } } })
  ]);
  return { students, staff };
}

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  res.json(await getBillingOverview(tenantSchoolId(req), await currentUsage()));
});

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await listPlans({ publicOnly: true }));
});

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const plan = await getPlanByCodeOrThrow(String(req.query.planCode));
  res.json(await quotePlan(plan, req.query.couponCode as string | undefined));
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  res.json(await listInvoices(tenantSchoolId(req)));
});

export const getInvoiceDetail = asyncHandler(async (req: Request, res: Response) => {
  res.json(await getInvoice(tenantSchoolId(req), req.params.invoiceId));
});

export const startCheckout = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(
    await createCheckoutSession({
      schoolId: tenantSchoolId(req),
      planCode: req.body.planCode,
      couponCode: req.body.couponCode,
      actor: actorFrom(req)
    })
  );
});

export const completeCheckout = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    await confirmCheckout({
      schoolId: tenantSchoolId(req),
      payload: req.body,
      actor: actorFrom(req)
    })
  );
});

export const setAutoRenew = asyncHandler(async (req: Request, res: Response) => {
  res.json(await setCancelAtPeriodEnd(tenantSchoolId(req), !req.body.autoRenew, actorFrom(req)));
});

/**
 * Stands in for Razorpay's hosted checkout. Only reachable while
 * RAZORPAY_MODE=mock — in live mode the browser talks to Razorpay directly.
 */
export const payViaMockGateway = asyncHandler(async (req: Request, res: Response) => {
  assertMockGateway();
  const schoolId = tenantSchoolId(req);
  const result = await mockGatewayPay(req.body);
  if (result.status === "failed") {
    res.status(402).json({ error: { code: "PAYMENT_DECLINED", message: result.reason } });
    return;
  }
  res.json({ ...result, schoolId, gateway: razorpay.mode });
});
