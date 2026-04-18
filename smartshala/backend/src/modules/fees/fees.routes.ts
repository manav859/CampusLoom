import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./fees.controller.js";
import { assignFeeSchema, feeStructureSchema, paymentSchema } from "./fees.schemas.js";

export const feesRouter = Router();

feesRouter.use(requireAuth);
feesRouter.get("/dashboard", requireRole(UserRole.ADMIN), controller.dashboard);
feesRouter.get("/structures", requireRole(UserRole.ADMIN), controller.listFeeStructures);
feesRouter.post("/structures", requireRole(UserRole.ADMIN), validate({ body: feeStructureSchema }), controller.createFeeStructure);
feesRouter.post("/assignments", requireRole(UserRole.ADMIN), validate({ body: assignFeeSchema }), controller.assignFee);
feesRouter.post("/payments", requireRole(UserRole.ADMIN), validate({ body: paymentSchema }), controller.collectPayment);
feesRouter.get("/students/:studentId/ledger", requireRole(UserRole.ADMIN), controller.getStudentLedger);
feesRouter.get("/defaulters", requireRole(UserRole.ADMIN), controller.defaulters);

