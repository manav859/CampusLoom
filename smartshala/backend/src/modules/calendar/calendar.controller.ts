import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as calendarService from "./calendar.service.js";

export const listMonth = asyncHandler(async (req: Request, res: Response) => {
  res.json(await calendarService.listMonth(req.user!, req.query.month as string));
});

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await calendarService.createEvent(req.user!, req.body));
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await calendarService.updateEvent(req.user!, req.params.id, req.body));
});

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  await calendarService.deleteEvent(req.user!, req.params.id);
  res.status(204).end();
});
