import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as dashboardService from "./dashboard.service.js";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  res.json(await dashboardService.getDashboard(req.user!));
});

