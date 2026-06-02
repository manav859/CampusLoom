import type { Response } from "express";
import { env } from "../config/env.js";

const COOKIE_NAME = "ss_rt";   // ss = smartshala, rt = refresh token
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/",             // available to /auth/refresh endpoint
    maxAge: REFRESH_TTL_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function getRefreshToken(req: { cookies: Record<string, string> }): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}
