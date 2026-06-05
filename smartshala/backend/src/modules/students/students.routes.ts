import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./students.controller.js";
import { behaviourActionSchema, behaviourRecordSchema, importStudentsSchema, studentDocumentSchema, studentSchema } from "./students.schemas.js";

export const studentsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;
const behaviourRoles = [UserRole.TEACHER] as const;
const documentRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

studentsRouter.use(requireAuth);
studentsRouter.get("/", controller.listStudents);
studentsRouter.post("/import", requireRole(adminRoles), validate({ body: importStudentsSchema }), controller.importStudents);
studentsRouter.get("/:id", controller.getStudent);
studentsRouter.get(
  "/:id/report-card/pdf",
  requireRole([UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.PARENT]),
  controller.getStudentReportCardPdf
);
studentsRouter.get("/:id/documents/:documentId/download", requireRole(documentRoles), controller.downloadStudentDocument);
studentsRouter.delete("/:id/documents/:documentId", requireRole(documentRoles), controller.deleteStudentDocument);
studentsRouter.post(
  "/:id/documents",
  requireRole(documentRoles),
  upload.single("file"),
  validate({ body: studentDocumentSchema }),
  controller.uploadStudentDocument
);
studentsRouter.post("/:id/behaviour", requireRole(behaviourRoles), validate({ body: behaviourRecordSchema }), controller.createBehaviourRecord);
studentsRouter.patch(
  "/:id/behaviour/:recordId/action",
  requireRole(adminRoles),
  validate({ body: behaviourActionSchema }),
  controller.updateBehaviourAction
);
studentsRouter.post("/", requireRole(adminRoles), validate({ body: studentSchema }), controller.createStudent);
studentsRouter.patch("/:id/activate", requireRole(adminRoles), controller.activateStudent);
studentsRouter.patch("/:id", requireRole(adminRoles), validate({ body: studentSchema.partial() }), controller.updateStudent);
studentsRouter.delete("/:id", requireRole(adminRoles), controller.deactivateStudent);
