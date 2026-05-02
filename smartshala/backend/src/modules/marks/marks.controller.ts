import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as marksService from "./marks.service.js";

export const context = asyncHandler(async (req: Request, res: Response) => {
  res.json(await marksService.marksContext(req.user!));
});

export const listExams = asyncHandler(async (req: Request, res: Response) => {
  res.json(await marksService.listExams(req.user!, req.query));
});

export const createExamWithMarks = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await marksService.createExamWithMarks(req.user!, req.body));
});
