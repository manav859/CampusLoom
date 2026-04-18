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

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.updateUser(req.user!.schoolId, req.params.id, req.body));
});

