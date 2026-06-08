import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as service from "./academicYears.service.js";

export const listAcademicYears = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.listAcademicYears(req.user!.schoolId));
});

export const getCurrentAcademicYear = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getCurrentAcademicYear(req.user!.schoolId));
});

export const createAcademicYear = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.createAcademicYear(req.user!.schoolId, req.body));
});

export const rolloverPreview = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.rolloverPreview(req.user!.schoolId, req.body.targetName));
});

export const rolloverCommit = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.rolloverCommit(req.user!.schoolId, req.user!.id, req.body));
});
