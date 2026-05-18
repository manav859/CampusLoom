import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as usersService from "./users.service.js";

export const listTeachers = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.listUsers(req.user!.schoolId, req.query, UserRole.TEACHER));
});

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await usersService.createUser(req.user!.schoolId, req.body));
});

export const createAccountant = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await usersService.createUser(req.user!.schoolId, { ...req.body, role: UserRole.ACCOUNTANT }));
});

export const getTeacherAssignments = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.getTeacherAssignments(req.user!.schoolId, req.params.id));
});

export const updateTeacherAssignments = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.updateTeacherAssignments(req.user!.schoolId, req.params.id, req.body.periods));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.updateUser(req.user!.schoolId, req.params.id, req.body));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  res.status(204).json(await usersService.deleteUser(req.user!.schoolId, req.params.id));
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.activateUser(req.user!.schoolId, req.params.id));
});
