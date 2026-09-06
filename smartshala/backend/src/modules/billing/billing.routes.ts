import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./billing.controller.js";
import {
  autoRenewSchema,
  checkoutSchema,
  confirmCheckoutSchema,
  invoiceParamSchema,
  mockPaySchema,
  quoteQuerySchema
} from "./billing.schemas.js";

export const billingRouter = Router();

// Billing is the principal's commercial relationship with SmartShala, so it is
// deliberately narrower than the usual PRINCIPAL+ADMIN pair.
const billingRoles = [UserRole.PRINCIPAL] as const;

billingRouter.use(requireAuth, requireRole(billingRoles));

billingRouter.get("/overview", controller.getOverview);
billingRouter.get("/plans", controller.getPlans);
billingRouter.get("/quote", validate({ query: quoteQuerySchema }), controller.getQuote);
billingRouter.get("/invoices", controller.getInvoices);
billingRouter.get("/invoices/:invoiceId", validate({ params: invoiceParamSchema }), controller.getInvoiceDetail);

billingRouter.post(
  "/checkout",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: "billing-checkout" }),
  validate({ body: checkoutSchema }),
  controller.startCheckout
);

billingRouter.post(
  "/checkout/confirm",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "billing-confirm" }),
  validate({ body: confirmCheckoutSchema }),
  controller.completeCheckout
);

billingRouter.patch("/auto-renew", validate({ body: autoRenewSchema }), controller.setAutoRenew);

billingRouter.post(
  "/mock-gateway/pay",
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "billing-mock-pay" }),
  validate({ body: mockPaySchema }),
  controller.payViaMockGateway
);
