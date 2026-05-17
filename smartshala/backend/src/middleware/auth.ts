import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../core/errors.js";

type AccessTokenPayload = {
  sub: string;
  schoolId: string;
  tenantSchoolId?: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  email?: string | null;
  schoolName?: string;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    throw new AppError(401, "Missing bearer token", "AUTH_REQUIRED");
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (!payload.sub) throw new Error("Missing subject");
    if (req.tenant && payload.tenantSchoolId && payload.tenantSchoolId !== req.tenant.schoolId) {
      throw new Error("Tenant mismatch");
    }
    req.user = {
      id: payload.sub,
      schoolId: payload.schoolId,
      tenantSchoolId: payload.tenantSchoolId,
      role: payload.role,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      schoolName: payload.schoolName
    };
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token", "INVALID_TOKEN");
  }
}

export function requireRole(rolesOrFirst: readonly UserRole[] | UserRole, ...rest: UserRole[]) {
  const roles = Array.isArray(rolesOrFirst) ? rolesOrFirst : [rolesOrFirst, ...rest];
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "You do not have permission to perform this action", "FORBIDDEN");
    }
    next();
  };
}
