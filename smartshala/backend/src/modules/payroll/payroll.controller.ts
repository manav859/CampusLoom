import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as payrollService from "./payroll.service.js";
import * as payrollCalc from "./payrollCalc.service.js";

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

export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollCalc.listShifts(req.user!));
});

export const createShift = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await payrollCalc.saveShift(req.user!, null, req.body));
});

export const updateShift = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollCalc.saveShift(req.user!, req.params.id, req.body));
});

export const deleteShift = asyncHandler(async (req: Request, res: Response) => {
  await payrollCalc.deleteShift(req.user!, req.params.id);
  res.status(204).end();
});

export const savePayProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollCalc.savePayProfile(req.user!, req.params.userId, req.body));
});

export const calculateMonth = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollCalc.calculateMonth(req.user!, req.query.month as string));
});

export const generateSlips = asyncHandler(async (req: Request, res: Response) => {
  res.json(await payrollCalc.generateSlips(req.user!, req.body.month));
});
