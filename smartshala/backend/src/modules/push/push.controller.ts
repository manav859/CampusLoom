import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as pushService from "./push.service.js";

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await pushService.registerDevice(req.user!, req.body));
});

export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  res.json(await pushService.unregisterDevice(req.user!, req.body.fid));
});
