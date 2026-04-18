import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as notificationsService from "./notifications.service.js";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationsService.listNotifications(req.user!.schoolId));
});

export const queueNotification = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await notificationsService.queueNotification(req.user!.schoolId, req.body));
});

