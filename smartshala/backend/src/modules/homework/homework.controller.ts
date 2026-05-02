import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as homeworkService from "./homework.service.js";

export const context = asyncHandler(async (req: Request, res: Response) => {
  res.json(await homeworkService.homeworkContext(req.user!));
});

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  res.json(await homeworkService.listAssignments(req.user!, req.query));
});

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await homeworkService.createAssignment(req.user!, req.body));
});
