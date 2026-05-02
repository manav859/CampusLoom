import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as communicationService from "./communication.service.js";

export const context = asyncHandler(async (req: Request, res: Response) => {
  res.json(await communicationService.communicationContext(req.user!));
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  res.json(await communicationService.listTeacherMessages(req.user!, req.query));
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await communicationService.sendTeacherMessage(req.user!, req.body));
});
