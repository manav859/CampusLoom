import type { Request, Response } from "express";
import { join } from "node:path";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as staffAttendanceService from "./staffAttendance.service.js";

export const getTodayStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getTodayStatus(req.user!));
});

export const punchIn = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await staffAttendanceService.punchIn(req.user!, req.file));
});

export const getPunchSelfie = asyncHandler(async (req: Request, res: Response) => {
  const { url, mimeType } = await staffAttendanceService.getPunchSelfie(
    req.user!,
    req.params.id,
    req.query.date as string
  );

  // Same split as leave attachments: S3 hands back a presigned URL the browser
  // can load directly, while the local fallback has no public URL at all — so
  // stream the image itself rather than a key no <img> can resolve.
  if (url.startsWith("http")) {
    res.json({ url });
    return;
  }

  const localPath = join(process.cwd(), "uploads", ...url.split("/"));
  res.type(mimeType);
  await new Promise<void>((resolve, reject) => {
    res.sendFile(localPath, (error) => (error ? reject(error) : resolve()));
  });
});

export const startBreak = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.startBreak(req.user!));
});

export const punchOut = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.punchOut(req.user!));
});

export const getMyHistory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getMyHistory(req.user!, req.query.month as string));
});

export const getStaffMonthSummary = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getStaffMonthSummary(req.user!.schoolId, req.params.id, req.query.month as string));
});

export const getStaffDay = asyncHandler(async (req: Request, res: Response) => {
  res.json(await staffAttendanceService.getStaffDay(req.user!.schoolId, req.query.date as string));
});
