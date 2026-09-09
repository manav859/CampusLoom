import { Router } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { assertMockGateway } from "../../services/razorpay/index.js";
import {
  confirmCheckoutSchema,
  paymentLinkMockPaySchema,
  paymentLinkTokenParamSchema
} from "./billing.schemas.js";
import {
  confirmPaymentLinkPayment,
  getPaymentLinkView,
  payPaymentLinkViaMockGateway,
  startPaymentLinkCheckout
} from "./paymentLinks.service.js";

/**
 * Unauthenticated by design: the token in the URL is the credential. Every
 * route is rate-limited on that basis, and each one re-checks the link rather
 * than trusting anything the browser sends.
 */
export const paymentLinkRouter = Router();

paymentLinkRouter.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyPrefix: "pay-link" }));

paymentLinkRouter.get(
  "/:token",
  validate({ params: paymentLinkTokenParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getPaymentLinkView(req.params.token));
  })
);

paymentLinkRouter.post(
  "/:token/checkout",
  validate({ params: paymentLinkTokenParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await startPaymentLinkCheckout(req.params.token));
  })
);

paymentLinkRouter.post(
  "/:token/confirm",
  validate({ params: paymentLinkTokenParamSchema, body: confirmCheckoutSchema }),
  asyncHandler(async (req, res) => {
    res.json(await confirmPaymentLinkPayment(req.params.token, req.body));
  })
);

paymentLinkRouter.post(
  "/:token/mock-gateway/pay",
  validate({ params: paymentLinkTokenParamSchema, body: paymentLinkMockPaySchema }),
  asyncHandler(async (req, res) => {
    assertMockGateway();
    res.json(await payPaymentLinkViaMockGateway({ token: req.params.token, ...req.body }));
  })
);
