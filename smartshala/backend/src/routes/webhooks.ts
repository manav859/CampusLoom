import express, { Router } from "express";
import { asyncHandler } from "../core/asyncHandler.js";
import { handleRazorpayWebhook } from "../modules/billing/billing.service.js";

export const webhooksRouter = Router();

/**
 * Razorpay signs the exact bytes it sent, so this route parses the body as raw
 * text — the global express.json() would re-serialise it and break the HMAC.
 * Mounted outside the tenant router: the gateway knows nothing about schoolIds.
 */
webhooksRouter.post(
  "/razorpay",
  express.raw({ type: "*/*", limit: "256kb" }),
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
    const signature = req.get("x-razorpay-signature") ?? undefined;
    res.json(await handleRazorpayWebhook(rawBody, signature));
  })
);
