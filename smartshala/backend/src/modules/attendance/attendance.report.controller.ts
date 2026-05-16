import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as attendanceReportService from "./attendance.report.service.js";

export const getClassesTodayReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceReportService.getClassesTodayReport(
    req.user!,
    req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
  ));
});

export const nudgePendingTeachers = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceReportService.nudgePendingTeachers(
    req.user!,
    req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
  ));
});
