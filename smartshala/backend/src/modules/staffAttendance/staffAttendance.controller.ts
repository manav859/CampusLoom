import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as staffAttendanceService from "./staffAttendance.service.js";

export const getTodayStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getTodayStatus(req.user!));
});

export const punchIn = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await staffAttendanceService.punchIn(req.user!));
});

export const punchOut = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.punchOut(req.user!));
});

export const getMyHistory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getMyHistory(req.user!, req.query.month as string));
});
