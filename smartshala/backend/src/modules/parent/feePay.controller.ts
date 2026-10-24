import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as feePay from "./feePay.service.js";

export const view = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feePay.viewFeePayment(req.params.token));
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feePay.startFeePaymentCheckout(req.params.token));
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feePay.confirmFeePayment(req.params.token, req.body));
});

export const mockGatewayPay = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    await feePay.payFeePaymentViaMockGateway({
      token: req.params.token,
      orderId: req.body.orderId,
      outcome: req.body.outcome,
      method: req.body.method
    })
  );
});
