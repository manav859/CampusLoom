import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as studentsService from "./students.service.js";

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.listStudents(req.user!, req.query));
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.getStudent(req.user!, req.params.id));
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.createStudent(req.user!.schoolId, req.body));
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.updateStudent(req.user!.schoolId, req.params.id, req.body));
});

export const deactivateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.deactivateStudent(req.user!.schoolId, req.params.id));
});

export const activateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.activateStudent(req.user!.schoolId, req.params.id));
});

