import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as feesService from "./fees.service.js";

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feesService.dashboard(req.user!.schoolId));
});

export const listFeeStructures = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feesService.listFeeStructures(req.user!.schoolId));
});

export const getFeeStructure = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feesService.getFeeStructure(req.user!.schoolId, req.params.id));
});

export const createFeeStructure = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await feesService.createFeeStructure(req.user!.schoolId, req.body));
});

export const assignFee = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await feesService.assignFee(req.user!.schoolId, req.body.studentId, req.body.feeStructureId));
});

export const assignFeeStructureToClass = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await feesService.assignFeeStructureToClass(req.user!.schoolId, req.params.id));
});

export const collectPayment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await feesService.collectPayment(req.user!, req.body));
});

export const getStudentLedger = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feesService.getStudentLedger(req.user!.schoolId, req.params.studentId));
});

export const defaulters = asyncHandler(async (req: Request, res: Response) => {
  res.json(await feesService.defaulters(req.user!.schoolId));
});

export const receiptPdf = asyncHandler(async (req: Request, res: Response) => {
  const pdfBuffer = await feesService.getReceiptPdf(req.user!.schoolId, req.params.receiptId);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="receipt-${req.params.receiptId}.pdf"`,
    "Content-Length": pdfBuffer.length.toString()
  });
  res.send(pdfBuffer);
});
