import { NotificationKind } from "@prisma/client";
import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as whatsappService from "./whatsapp.service.js";

type SendMessageBody = {
  phone: string;
  message: string;
};

type BulkMessageBody = SendMessageBody[];

export const sendMessage = asyncHandler<Request<Record<string, never>, unknown, SendMessageBody>>(async (req, res: Response) => {
  res.json(
    await whatsappService.sendMessage(req.body.phone, req.body.message, {
      schoolId: req.user!.schoolId,
      kind: NotificationKind.SCHOOL_ALERT
    })
  );
});

export const sendBulk = asyncHandler<Request<Record<string, never>, unknown, BulkMessageBody>>(async (req, res: Response) => {
  res.json(
    await whatsappService.sendBulk(req.body, {
      schoolId: req.user!.schoolId,
      kind: NotificationKind.SCHOOL_ALERT
    })
  );
});

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  res.json(await whatsappService.getLogs(req.user!.schoolId));
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  res.json(await whatsappService.getStats(req.user!.schoolId, req.query));
});

export const retryNotification = asyncHandler(async (req: Request, res: Response) => {
  res.json(await whatsappService.retryNotification(req.user!.schoolId, req.params.id));
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  res.json(await whatsappService.deleteNotification(req.user!.schoolId, req.params.id));
});

export const clearNotifications = asyncHandler(async (req: Request, res: Response) => {
  res.json(await whatsappService.clearNotifications(req.user!.schoolId));
});
