import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./payroll.controller.js";
import { payrollMonthQuerySchema, salarySlipParamsSchema, salarySlipSchema } from "./payroll.schemas.js";

export const payrollRouter = Router();

const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT] as const;
const managerRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

payrollRouter.use(requireAuth, requireRole(staffRoles));

// Own slips only: the caller is the subject, so there is no user id to tamper with.
payrollRouter.get("/me/slips", controller.listMySlips);

payrollRouter.get("/slips", requireRole(managerRoles), validate({ query: payrollMonthQuerySchema }), controller.listMonth);
payrollRouter.put("/slips", requireRole(managerRoles), validate({ body: salarySlipSchema }), controller.saveSlip);
payrollRouter.delete(
  "/slips/:id",
  requireRole(managerRoles),
  validate({ params: salarySlipParamsSchema }),
  controller.deleteSlip
);
