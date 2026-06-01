import type { Request, Response, NextFunction } from "express";
import { getTenantContext } from "../tenant/tenantContext.js";
import { AppError } from "../core/errors.js";
import { env } from "../config/env.js";

/** Routes that legitimately work without a tenant context. */
const TENANT_AGNOSTIC_PREFIXES = [
  "/auth/",
  "/health",
  "/onboarding/",
  "/super-admin/",
  "/tenant-setup/",
];

function isTenantAgnostic(path: string): boolean {
  return TENANT_AGNOSTIC_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix)
  );
}

/**
 * In multi-tenant mode (MASTER_DATABASE_URL is set), reject any
 * request that arrived without a resolved tenant context.
 * Allows /auth/*, /onboarding/*, /health/* etc. to pass through
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

  // Check if this is a tenant-agnostic route
  // req.path here is relative to the mount point (/api or /api/v1)
  if (isTenantAgnostic(req.path)) {
    return next();
  }

  // No tenant context on a multi-tenant deployment = reject
  throw new AppError(
    400,
    "Requests to tenant data must use the /:schoolId/api prefix",
    "TENANT_CONTEXT_REQUIRED"
  );
}

