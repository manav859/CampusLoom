import { join } from "node:path";
import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as studentsService from "./students.service.js";
import * as reportCardService from "./report-card.service.js";

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.listStudents(req.user!, req.query));
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.getStudent(req.user!, req.params.id));
});

export const createBehaviourRecord = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.createBehaviourRecord(req.user!, req.params.id, req.body));
});

export const updateBehaviourAction = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.updateBehaviourAction(req.user!, req.params.id, req.params.recordId, req.body));
});

export const uploadStudentDocument = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.uploadStudentDocument(req.user!, req.params.id, req.body, req.file));
});

export const downloadStudentDocument = asyncHandler(async (req: Request, res: Response) => {
  const { downloadUrl, fileName } = await studentsService.downloadStudentDocument(
    req.user!,
    req.params.id,
    req.params.documentId
  );

  if (downloadUrl.startsWith("http")) {
    // S3 presigned URL — return it as JSON so the client navigates directly to
    // S3 (a 302 would be auto-followed by fetch and blocked by the CSP
    // connect-src directive).
    res.json({ downloadUrl, fileName });
    return;
  }

  // Local fallback — serve the file directly (dev only). The key uses forward
  // slashes; join() maps it onto the local uploads/ directory.
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

export const deleteStudentDocument = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.deleteStudentDocument(req.user!, req.params.id, req.params.documentId));
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.createStudent(req.user!, req.body));
});

export const importStudents = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.importStudents(req.user!, req.body.students));
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.updateStudent(req.user!, req.params.id, req.body));
});

export const deactivateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.deactivateStudent(req.user!, req.params.id));
});

export const activateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.activateStudent(req.user!, req.params.id));
});

export const getStudentReportCardPdf = asyncHandler(async (req: Request, res: Response) => {
  const pdfBuffer = await reportCardService.getStudentReportCardPdf(req.user!, req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-card-${req.params.id}.pdf"`);
  res.send(pdfBuffer);
});
