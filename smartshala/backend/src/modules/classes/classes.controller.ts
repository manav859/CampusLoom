import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as classesService from "./classes.service.js";

export const listClasses = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.listClasses(req.user!));
});

export const createClass = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await classesService.createClass(req.user!.schoolId, req.body));
});

export const updateClass = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.updateClass(req.user!.schoolId, req.params.id, req.body));
});

export const getClassStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.getClassStudents(req.user!, req.params.id));
});

