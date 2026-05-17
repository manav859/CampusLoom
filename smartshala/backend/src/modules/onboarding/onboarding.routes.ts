import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../core/asyncHandler.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { previewCoupon } from "../../services/coupon.service.js";
import { couponPreviewSchema, onboardingSchema } from "./onboarding.schemas.js";
import { onboardSchool } from "./onboarding.service.js";

export const onboardingRouter = Router();

onboardingRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "onboarding" }));

onboardingRouter.post(
  "/",
  validate({ body: onboardingSchema }),
  asyncHandler(async (req, res) => {
    const result = await onboardSchool(req.body);
    res.status(201).json(result);
  })
);

onboardingRouter.get(
  "/coupon-preview",
  validate({ query: couponPreviewSchema }),
  asyncHandler(async (req, res) => {
    res.json(await previewCoupon(req.query.code as string | undefined));
  })
);
