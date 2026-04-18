import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as analyticsService from "./analytics.service.js";

export const riskSummary = asyncHandler(async (req: Request, res: Response) => {
  res.json(await analyticsService.riskSummary(req.user!));
});

export const classPerformance = asyncHandler(async (req: Request, res: Response) => {
  res.json(await analyticsService.classPerformance(req.user!));
});

