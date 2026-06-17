import type { Response } from "express";
import { env } from "../config/env.js";

const COOKIE_NAME = "ss_sa";   // ss = smartshala, sa = super admin session
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;  // 8h — matches the super-admin JWT expiry

// Mirrors the refresh cookie: SameSite=None+Secure in production (frontend and
// backend live on different origins), falling back to "lax" for local HTTP dev.
const SAME_SITE = env.COOKIE_SECURE ? "none" : "lax";

export function setSuperAdminCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: SAME_SITE,
    path: "/",
    maxAge: SESSION_TTL_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearSuperAdminCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function getSuperAdminCookie(req: { cookies: Record<string, string> }): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}
