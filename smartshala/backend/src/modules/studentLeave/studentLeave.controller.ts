import type { Request, Response } from "express";
import { LeaveStatus } from "@prisma/client";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as service from "./studentLeave.service.js";

export const listStudentLeave = asyncHandler(async (req: Request, res: Response) => {
  const { status, limit, offset } = req.query as unknown as {
    status?: LeaveStatus;
    limit: number;
    offset: number;
  };
  res.json(await service.listStudentLeave(req.user!, { status, limit, offset }));
});

export const decideStudentLeave = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.decideStudentLeave(req.user!, req.params.id, req.body));
});
