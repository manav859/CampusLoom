import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as announcementsService from "./announcements.service.js";

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await announcementsService.createAnnouncement(req.user!, req.body));
});

export const listAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  res.json(await announcementsService.listAnnouncements(req.user!, req.query as never));
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await announcementsService.markAsRead(req.user!, req.params.id));
});
