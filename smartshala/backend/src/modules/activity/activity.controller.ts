import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as activityService from "./activity.service.js";

export const listActivityLogs = asyncHandler(async (req: Request, res: Response) => {
  res.json(await activityService.listActivityLogs(req.user!, req.query));
});
