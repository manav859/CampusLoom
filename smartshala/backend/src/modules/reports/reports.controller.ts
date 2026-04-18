import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as reportsService from "./reports.service.js";

export const dailyPrincipalReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await reportsService.dailyPrincipalReport(req.user!, req.query.date ? new Date(req.query.date as string) : new Date()));
});

export const monthlyStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await reportsService.monthlyStudent(req.user!, req.params.studentId, req.query.month as string));
});

export const feePending = asyncHandler(async (req: Request, res: Response) => {
  res.json(await reportsService.feePending(req.user!.schoolId));
});

export const risk = asyncHandler(async (req: Request, res: Response) => {
  res.json(await reportsService.risk(req.user!));
});

export const classReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await reportsService.classReport(req.user!));
});

