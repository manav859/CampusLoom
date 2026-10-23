import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as parentService from "./parent.service.js";

export const listChildren = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.listChildren(req.user!);
  res.json(result);
});
