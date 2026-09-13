import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as payrollService from "./payroll.service.js";

export const listMySlips = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollService.listMySlips(req.user!));
});

export const listMonth = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollService.listMonth(req.user!, req.query.month as string));
});

export const saveSlip = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollService.saveSlip(req.user!, req.body));
});

export const deleteSlip = asyncHandler(async (req: Request, res: Response) => {
  await payrollService.deleteSlip(req.user!, req.params.id);
  res.status(204).end();
});
