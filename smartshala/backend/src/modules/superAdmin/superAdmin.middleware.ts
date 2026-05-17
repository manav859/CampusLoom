import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";

type SuperAdminTokenPayload = {
  kind: "SUPER_ADMIN";
  email: string;
};

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    throw new AppError(401, "Missing bearer token", "SUPER_ADMIN_AUTH_REQUIRED");
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as SuperAdminTokenPayload;
    if (payload.kind !== "SUPER_ADMIN" || payload.email !== env.SUPER_ADMIN_EMAIL) {
      throw new Error("Invalid super admin token");
    }
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token", "INVALID_SUPER_ADMIN_TOKEN");
  }
}
