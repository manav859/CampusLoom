import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { AppError } from "../../core/errors.js";
import {
  cancelTenantDeletion,
  getTenantDeletionStatus,
  requestTenantDeletion
} from "../../services/databaseDeletion.service.js";
import * as settingsService from "./settings.service.js";

export const getSchoolProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json(await settingsService.getSchoolProfile(req.user!.schoolId));
});

export const updateSchoolProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json(await settingsService.updateSchoolProfile(req.user!.schoolId, req.body));
});

function tenantSchoolIdFromRequest(req: Request) {
  const schoolId = req.tenant?.schoolId ?? req.user?.tenantSchoolId;
  if (!schoolId) {
    throw new AppError(400, "Open this setting from a school workspace before scheduling deletion", "TENANT_CONTEXT_REQUIRED");
  }
  return schoolId;
}

export const getDatabaseDeletionStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await getTenantDeletionStatus(tenantSchoolIdFromRequest(req)));
});

export const requestDatabaseDeletion = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(
    await requestTenantDeletion({
      schoolId: tenantSchoolIdFromRequest(req),
      requestedByUserId: req.user!.id,
      requestedByRole: req.user!.role,
      password: req.body.password
    })
  );
});

export const cancelDatabaseDeletion = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    await cancelTenantDeletion({
      schoolId: tenantSchoolIdFromRequest(req),
      cancelledByUserId: req.user!.id,
      password: req.body.password
    })
  );
});
