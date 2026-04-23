import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as attendanceReportService from "./attendance.report.service.js";

export const getClassesTodayReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceReportService.getClassesTodayReport(req.user!));
});
