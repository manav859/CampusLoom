import { join } from "node:path";
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

export const schoolCalendar = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.schoolCalendar(req.user!, req.query.month as string | undefined);
  res.json(result);
});

export const announcements = asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset } = req.query as unknown as { limit: number; offset: number };
  const result = await parentService.parentAnnouncements(req.user!, { limit, offset });
  res.json(result);
});

export const childDocuments = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.childDocuments(req.user!, req.params.id);
  res.json(result);
});

export const childDocumentDownload = asyncHandler(async (req: Request, res: Response) => {
  const { downloadUrl, fileName } = await parentService.childDocumentDownload(
    req.user!,
    req.params.id,
    req.params.documentId
  );

  // S3 presigned URL — hand it to the client as JSON so it navigates there
  // directly (the app opens it in a browser tab).
  if (downloadUrl.startsWith("http")) {
    res.json({ downloadUrl, fileName });
    return;
  }

  // Local fallback — serve the file directly (dev only).
  const localPath = join(process.cwd(), "uploads", ...downloadUrl.split("/"));
  await new Promise<void>((resolve, reject) => {
    res.download(localPath, fileName, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
