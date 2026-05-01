import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as studentsService from "./students.service.js";

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.listStudents(req.user!, req.query));
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.getStudent(req.user!, req.params.id));
});

export const createBehaviourRecord = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.createBehaviourRecord(req.user!, req.params.id, req.body));
});

export const uploadStudentDocument = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.uploadStudentDocument(req.user!, req.params.id, req.body, req.file));
});

export const downloadStudentDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = await studentsService.getStudentDocumentFile(req.user!, req.params.id, req.params.documentId);

  await new Promise<void>((resolve, reject) => {
    res.download(file.filePath, file.originalName, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await studentsService.createStudent(req.user!.schoolId, req.body));
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.updateStudent(req.user!.schoolId, req.params.id, req.body));
});

export const deactivateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.deactivateStudent(req.user!.schoolId, req.params.id));
});

export const activateStudent = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentsService.activateStudent(req.user!.schoolId, req.params.id));
});
