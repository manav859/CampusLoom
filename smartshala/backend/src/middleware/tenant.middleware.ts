import type { NextFunction, Request, Response } from "express";
import { getTenantPrismaClient } from "../tenant/prismaManager.js";
import { resolveTenant } from "../tenant/tenantResolver.js";
import { runWithTenant } from "../tenant/tenantContext.js";

/**
 * A school whose subscription has lapsed is locked out of the product, but it
 * must still be able to sign in and pay — otherwise the only way back is a
 * support ticket. These prefixes stay reachable while suspended; everything
 * else keeps returning 402 SCHOOL_INACTIVE.
 */
const SUSPENDED_TENANT_ALLOWLIST = ["/auth", "/billing", "/health"];

function allowedWhileSuspended(path: string) {
  return SUSPENDED_TENANT_ALLOWLIST.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  let school: Awaited<ReturnType<typeof resolveTenant>>;
  let prisma: ReturnType<typeof getTenantPrismaClient>;
  try {
    const schoolId = String(req.params.schoolId ?? "").toUpperCase();
    school = await resolveTenant(schoolId, { allowSuspended: allowedWhileSuspended(req.path) });
    prisma = getTenantPrismaClient(school.dbUrl);
  } catch (error) {
    // Express 4 does not catch rejections from async middleware, so a thrown
    // AppError (e.g. SCHOOL_INACTIVE) would otherwise become an unhandled
    // rejection and the request would hang with no response. Forward it to the
    // error handler so the client gets a proper 4xx instead of a dead socket.
    next(error);
    return;
  }

  req.tenant = {
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    dbName: school.dbName,
    suspended: school.suspended
  };

  // Existing modules import a shared Prisma object. AsyncLocalStorage lets that
  // object resolve to the tenant database for only this request lifecycle.
  runWithTenant(
    {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      dbName: school.dbName,
      prisma
    },
    next
  );
}
