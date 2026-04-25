import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as classesService from "./classes.service.js";

export const listClasses = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.listClasses(req.user!));
});

export const createClass = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await classesService.createClass(req.user!.schoolId, req.body));
});

export async function updateClass(req: Request, res: Response) {
  res.json(await classesService.updateClass(req.user!.schoolId, req.params.id, req.body));
}

export const getClass = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.getClass(req.user!, req.params.id));
});

export const getClassStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await classesService.getClassStudents(req.user!, req.params.id));
});

export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  res.status(204).json(await classesService.deleteClass(req.user!.schoolId, req.params.id));
});

