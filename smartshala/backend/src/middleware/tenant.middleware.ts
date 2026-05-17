import type { NextFunction, Request, Response } from "express";
import { getTenantPrismaClient } from "../tenant/prismaManager.js";
import { resolveTenant } from "../tenant/tenantResolver.js";
import { runWithTenant } from "../tenant/tenantContext.js";

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const schoolId = String(req.params.schoolId ?? "").toUpperCase();
  const school = await resolveTenant(schoolId);
  const prisma = getTenantPrismaClient(school.dbUrl);

  req.tenant = {
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    dbName: school.dbName
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
