import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../core/asyncHandler.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { requireSuperAdmin } from "./superAdmin.middleware.js";
import {
  loginSuperAdmin,
  listSchoolsForSuperAdmin,
  listSchoolUsers,
  resetTenantUserPassword,
  updateSchoolActiveStatus,
  updateTenantUserRole,
  updateTenantUserStatus
} from "./superAdmin.service.js";
import {
  resetUserPasswordSchema,
  schoolIdParamSchema,
  superAdminLoginSchema,
  updateSchoolStatusSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userActionParamSchema
} from "./superAdmin.schemas.js";

export const superAdminRouter = Router();

superAdminRouter.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "super-admin-login" }),
  validate({ body: superAdminLoginSchema }),
  asyncHandler(async (req, res) => {
    res.json(await loginSuperAdmin(req.body.email, req.body.password));
  })
);

superAdminRouter.use(requireSuperAdmin);

superAdminRouter.get(
  "/schools",
  asyncHandler(async (_req, res) => {
    res.json(await listSchoolsForSuperAdmin());
  })
);

superAdminRouter.patch(
  "/schools/:schoolId/status",
  validate({ params: schoolIdParamSchema, body: updateSchoolStatusSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateSchoolActiveStatus(req.params.schoolId, req.body.isActive));
  })
);

superAdminRouter.get(
  "/schools/:schoolId/users",
  validate({ params: schoolIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await listSchoolUsers(req.params.schoolId));
  })
);

superAdminRouter.patch(
  "/schools/:schoolId/users/:userId/status",
  validate({ params: userActionParamSchema, body: updateUserStatusSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateTenantUserStatus(req.params.schoolId, req.params.userId, req.body.isActive));
  })
);

superAdminRouter.patch(
  "/schools/:schoolId/users/:userId/password",
  validate({ params: userActionParamSchema, body: resetUserPasswordSchema }),
  asyncHandler(async (req, res) => {
    res.json(await resetTenantUserPassword(req.params.schoolId, req.params.userId, req.body.password));
  })
);

superAdminRouter.patch(
  "/schools/:schoolId/users/:userId/role",
  validate({ params: userActionParamSchema, body: updateUserRoleSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateTenantUserRole(req.params.schoolId, req.params.userId, req.body.role));
  })
);
