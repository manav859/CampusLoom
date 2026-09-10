import { Router } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { validate } from "../../middleware/validate.js";
import { schoolIdParamSchema } from "../superAdmin/superAdmin.schemas.js";
import {
  archivePlan,
  changeSchoolPlan,
  createCoupon,
  createManualInvoice,
  createPlan,
  deleteCoupon,
  extendSubscription,
  getRevenueSummary,
  getSchoolBilling,
  listAllInvoices,
  listAllPlans,
  listCoupons,
  listSubscriptions,
  markInvoicePaidOffline,
  refundPayment,
  getSchoolUsage,
  listRenewals,
  renewSubscription,
  setCustomPrice,
  setSchoolTaxDetails,
  setSubscriptionStatus,
  updateCoupon,
  updatePlan,
  voidInvoice
} from "./billingAdmin.service.js";
import { renderInvoicePdf } from "./billing.service.js";
import { createPaymentLink, listPaymentLinks, revokePaymentLink } from "./paymentLinks.service.js";
import { SUPER_ADMIN_ACTOR } from "./billingAdmin.service.js";
import {
  changePlanSchema,
  createPaymentLinkSchema,
  paymentLinkIdParamSchema,
  paymentLinkListQuerySchema,
  renewalsQuerySchema,
  renewSchema,
  schoolTaxSchema,
  couponIdParamSchema,
  createCouponSchema,
  createPlanSchema,
  customPriceSchema,
  extendSubscriptionSchema,
  invoiceListQuerySchema,
  invoiceParamSchema,
  manualInvoiceSchema,
  markPaidSchema,
  paymentIdParamSchema,
  planIdParamSchema,
  refundSchema,
  subscriptionListQuerySchema,
  subscriptionStatusSchema,
  updateCouponSchema,
  updatePlanSchema,
  voidInvoiceSchema
} from "./billing.schemas.js";

/** Mounted behind requireSuperAdmin by superAdmin.routes.ts. */
export const billingAdminRouter = Router();

// --- Dashboard ---------------------------------------------------------------

billingAdminRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    res.json(await getRevenueSummary());
  })
);

// --- Plans -------------------------------------------------------------------

billingAdminRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.json(await listAllPlans());
  })
);

billingAdminRouter.post(
  "/plans",
  validate({ body: createPlanSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createPlan(req.body));
  })
);

billingAdminRouter.patch(
  "/plans/:planId",
  validate({ params: planIdParamSchema, body: updatePlanSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updatePlan(req.params.planId, req.body));
  })
);

billingAdminRouter.delete(
  "/plans/:planId",
  validate({ params: planIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await archivePlan(req.params.planId));
  })
);

// --- Coupons -----------------------------------------------------------------

billingAdminRouter.get(
  "/coupons",
  asyncHandler(async (_req, res) => {
    res.json(await listCoupons());
  })
);

billingAdminRouter.post(
  "/coupons",
  validate({ body: createCouponSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCoupon(req.body));
  })
);

billingAdminRouter.patch(
  "/coupons/:couponId",
  validate({ params: couponIdParamSchema, body: updateCouponSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateCoupon(req.params.couponId, req.body));
  })
);

billingAdminRouter.delete(
  "/coupons/:couponId",
  validate({ params: couponIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await deleteCoupon(req.params.couponId));
  })
);

// --- Subscriptions -----------------------------------------------------------

billingAdminRouter.get(
  "/subscriptions",
  validate({ query: subscriptionListQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await listSubscriptions({
        status: req.query.status as never,
        planCode: req.query.planCode as string | undefined,
        query: req.query.query as string | undefined
      })
    );
  })
);

billingAdminRouter.get(
  "/schools/:schoolId",
  validate({ params: schoolIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getSchoolBilling(req.params.schoolId));
  })
);

billingAdminRouter.patch(
  "/schools/:schoolId/plan",
  validate({ params: schoolIdParamSchema, body: changePlanSchema }),
  asyncHandler(async (req, res) => {
    res.json(await changeSchoolPlan({ schoolId: req.params.schoolId, ...req.body }));
  })
);

billingAdminRouter.patch(
  "/schools/:schoolId/price",
  validate({ params: schoolIdParamSchema, body: customPriceSchema }),
  asyncHandler(async (req, res) => {
    res.json(await setCustomPrice({ schoolId: req.params.schoolId, ...req.body }));
  })
);

// --- Renewals ----------------------------------------------------------------

billingAdminRouter.get(
  "/renewals",
  validate({ query: renewalsQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await listRenewals(req.query.windowDays ? Number(req.query.windowDays) : undefined));
  })
);

billingAdminRouter.post(
  "/schools/:schoolId/renew",
  validate({ params: schoolIdParamSchema, body: renewSchema }),
  asyncHandler(async (req, res) => {
    res.json(await renewSubscription({ schoolId: req.params.schoolId, ...req.body }));
  })
);

// Read from the school's own database, so it is kept off the detail load.
billingAdminRouter.get(
  "/schools/:schoolId/usage",
  validate({ params: schoolIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getSchoolUsage(req.params.schoolId));
  })
);

billingAdminRouter.patch(
  "/schools/:schoolId/tax",
  validate({ params: schoolIdParamSchema, body: schoolTaxSchema }),
  asyncHandler(async (req, res) => {
    res.json(await setSchoolTaxDetails({ schoolId: req.params.schoolId, ...req.body }));
  })
);

billingAdminRouter.patch(
  "/schools/:schoolId/extend",
  validate({ params: schoolIdParamSchema, body: extendSubscriptionSchema }),
  asyncHandler(async (req, res) => {
    res.json(await extendSubscription(req.params.schoolId, req.body.days, req.body.reason));
  })
);

billingAdminRouter.patch(
  "/schools/:schoolId/status",
  validate({ params: schoolIdParamSchema, body: subscriptionStatusSchema }),
  asyncHandler(async (req, res) => {
    res.json(await setSubscriptionStatus(req.params.schoolId, req.body.status, req.body.reason));
  })
);

// --- Invoices & payments -----------------------------------------------------

billingAdminRouter.get(
  "/invoices",
  validate({ query: invoiceListQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await listAllInvoices({
        status: req.query.status as never,
        schoolId: req.query.schoolId as string | undefined,
        take: req.query.take ? Number(req.query.take) : undefined
      })
    );
  })
);

billingAdminRouter.post(
  "/schools/:schoolId/invoices",
  validate({ params: schoolIdParamSchema, body: manualInvoiceSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createManualInvoice({ schoolId: req.params.schoolId, ...req.body }));
  })
);

billingAdminRouter.get(
  "/invoices/:invoiceId/pdf",
  validate({ params: invoiceParamSchema }),
  asyncHandler(async (req, res) => {
    const { buffer, number } = await renderInvoicePdf(req.params.invoiceId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${number}.pdf"`,
      "Content-Length": buffer.length.toString()
    });
    res.send(buffer);
  })
);

billingAdminRouter.post(
  "/invoices/:invoiceId/mark-paid",
  validate({ params: invoiceParamSchema, body: markPaidSchema }),
  asyncHandler(async (req, res) => {
    res.json(await markInvoicePaidOffline({ invoiceId: req.params.invoiceId, ...req.body }));
  })
);

billingAdminRouter.post(
  "/invoices/:invoiceId/void",
  validate({ params: invoiceParamSchema, body: voidInvoiceSchema }),
  asyncHandler(async (req, res) => {
    res.json(await voidInvoice(req.params.invoiceId, req.body.reason));
  })
);

// --- Payment links -----------------------------------------------------------

billingAdminRouter.get(
  "/payment-links",
  validate({ query: paymentLinkListQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await listPaymentLinks({
        schoolId: req.query.schoolId as string | undefined,
        invoiceId: req.query.invoiceId as string | undefined,
        take: req.query.take ? Number(req.query.take) : undefined
      })
    );
  })
);

billingAdminRouter.post(
  "/invoices/:invoiceId/payment-links",
  validate({ params: invoiceParamSchema, body: createPaymentLinkSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await createPaymentLink({ invoiceId: req.params.invoiceId, ...req.body, actor: SUPER_ADMIN_ACTOR })
    );
  })
);

billingAdminRouter.post(
  "/payment-links/:linkId/revoke",
  validate({ params: paymentLinkIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await revokePaymentLink(req.params.linkId, SUPER_ADMIN_ACTOR));
  })
);

billingAdminRouter.post(
  "/payments/:paymentId/refund",
  validate({ params: paymentIdParamSchema, body: refundSchema }),
  asyncHandler(async (req, res) => {
    res.json(await refundPayment({ paymentId: req.params.paymentId, ...req.body }));
  })
);
