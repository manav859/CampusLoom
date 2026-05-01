import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./students.controller.js";
import { behaviourRecordSchema, studentDocumentSchema, studentSchema } from "./students.schemas.js";

export const studentsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;
const behaviourRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const documentRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

studentsRouter.use(requireAuth);
studentsRouter.get("/", controller.listStudents);
studentsRouter.get("/:id", controller.getStudent);
studentsRouter.get("/:id/documents/:documentId/download", requireRole(documentRoles), controller.downloadStudentDocument);
studentsRouter.post(
  "/:id/documents",
  requireRole(documentRoles),
  upload.single("file"),
  validate({ body: studentDocumentSchema }),
  controller.uploadStudentDocument
);
studentsRouter.post("/:id/behaviour", requireRole(behaviourRoles), validate({ body: behaviourRecordSchema }), controller.createBehaviourRecord);
studentsRouter.post("/", requireRole(adminRoles), validate({ body: studentSchema }), controller.createStudent);
studentsRouter.patch("/:id/activate", requireRole(adminRoles), controller.activateStudent);
studentsRouter.patch("/:id", requireRole(adminRoles), validate({ body: studentSchema.partial() }), controller.updateStudent);
studentsRouter.delete("/:id", requireRole(adminRoles), controller.deactivateStudent);
