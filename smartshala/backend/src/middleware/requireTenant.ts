import type { Request, Response, NextFunction } from "express";
import { getTenantContext } from "../tenant/tenantContext.js";
import { AppError } from "../core/errors.js";
import { env } from "../config/env.js";

/**
 * In multi-tenant mode (MASTER_DATABASE_URL is set), reject any
 * request that arrived without a resolved tenant context.
 * Allows /auth/*, /onboarding/*, /health/* to pass through
 * (they are legitimately tenant-agnostic).
 */
export function requireTenantInMultiTenantMode(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!env.MASTER_DATABASE_URL) {
    // Single-tenant / dev mode — no enforcement
    return next();
  }

  if (getTenantContext()) {
    // Tenant was resolved by tenantMiddleware — safe
    return next();
  }

  // No tenant context on a multi-tenant deployment = reject
  throw new AppError(
    400,
    "Requests to tenant data must use the /:schoolId/api prefix",
    "TENANT_CONTEXT_REQUIRED"
  );
}
