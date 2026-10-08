import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../core/asyncHandler.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { previewCoupon } from "../../services/coupon.service.js";
import { createWebsiteLead } from "../crm/crm.service.js";
import { couponPreviewSchema, onboardingSchema } from "./onboarding.schemas.js";

export const onboardingRouter = Router();

onboardingRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "onboarding" }));

// A school no longer signs itself up: the form becomes a lead in the sales CRM,
// and the school is created once it has paid its proforma.
onboardingRouter.post(
  "/",
  validate({ body: onboardingSchema }),
  asyncHandler(async (req, res) => {
    const { termsAccepted: _termsAccepted, ...lead } = req.body;
    const result = await createWebsiteLead(lead);
    res.status(201).json({ leadCode: result.code });
  })
);

onboardingRouter.get(
  "/coupon-preview",
  validate({ query: couponPreviewSchema }),
  asyncHandler(async (req, res) => {
    res.json(await previewCoupon(req.query.code as string | undefined));
  })
);
