import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../lib/rateLimit.js";
import * as controller from "./feePay.controller.js";
import { feePayConfirmSchema, feePayMockSchema, feePayTokenParamsSchema } from "./parent.schemas.js";

/**
 * The public student-fee payment page. Unauthenticated: the token in the URL is
 * the whole credential, so this sits with the other tenant-agnostic routers
 * (see requireTenant.ts) and the token's claims route to the right tenant DB.
 */
export const feePayRouter = Router();

const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: "fees:parent-pay",
  message: "Too many payment requests. Please slow down."
});

feePayRouter.get("/:token", validate({ params: feePayTokenParamsSchema }), controller.view);
feePayRouter.post("/:token/checkout", payLimiter, validate({ params: feePayTokenParamsSchema }), controller.checkout);
feePayRouter.post(
  "/:token/confirm",
  payLimiter,
  validate({ params: feePayTokenParamsSchema, body: feePayConfirmSchema }),
  controller.confirm
);
feePayRouter.post(
  "/:token/mock-gateway/pay",
  payLimiter,
  validate({ params: feePayTokenParamsSchema, body: feePayMockSchema }),
  controller.mockGatewayPay
);
