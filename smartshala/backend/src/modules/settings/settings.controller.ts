import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as settingsService from "./settings.service.js";

export const getSchoolProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json(await settingsService.getSchoolProfile(req.user!.schoolId));
});

export const updateSchoolProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json(await settingsService.updateSchoolProfile(req.user!.schoolId, req.body));
});
