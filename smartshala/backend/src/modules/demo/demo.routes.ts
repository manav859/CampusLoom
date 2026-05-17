import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../core/asyncHandler.js";
import { resetAndSeedDemoData } from "./demo.service.js";

export const demoRouter = Router();

demoRouter.use(requireAuth);

demoRouter.post(
  "/reset",
  requireRole([UserRole.PRINCIPAL, UserRole.ADMIN]),
  asyncHandler(async (req, res) => {
    const result = await resetAndSeedDemoData(req.user!, req.body);
    res.status(201).json(result);
  })
);
