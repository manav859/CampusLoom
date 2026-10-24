import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as parentService from "./parent.service.js";

export const listChildren = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.listChildren(req.user!);
  res.json(result);
});

export const childHome = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childHome(req.user!, req.params.id);
  res.json(result);
});

export const childAttendance = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childAttendance(req.user!, req.params.id, req.query.month as string | undefined);
  res.json(result);
});

export const childAcademics = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childAcademics(req.user!, req.params.id);
  res.json(result);
});

export const childHomework = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childHomework(req.user!, req.params.id);
  res.json(result);
});

export const childFees = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childFees(req.user!, req.params.id);
  res.json(result);
});

export const createFeePayLink = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.createFeePayLink(req.user!, req.params.id, req.body.assignmentId);
  res.json(result);
});

export const childFeeReceiptPdf = asyncHandler(async (req: Request, res: Response) => {
  const pdfBuffer = await parentService.childFeeReceiptPdf(req.user!, req.params.id, req.params.paymentId);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="receipt-${req.params.paymentId}.pdf"`,
    "Content-Length": pdfBuffer.length.toString()
  });
  res.send(pdfBuffer);
});
