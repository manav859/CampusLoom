import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as attendanceService from "./attendance.service.js";

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.getMarkingRoster(req.user!, req.query.classId as string, req.query.date ? new Date(req.query.date as string) : new Date()));
});

export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await attendanceService.markAttendance(req.user!, req.body));
});

export const dailyReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.dailyReport(req.user!, req.query.date ? new Date(req.query.date as string) : new Date()));
});

export const monthlyStudentReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.monthlyStudentReport(req.user!, req.params.studentId, req.query.month as string));
});

