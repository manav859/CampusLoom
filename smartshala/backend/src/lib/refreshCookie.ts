import type { Response } from "express";
import { env } from "../config/env.js";

const COOKIE_NAME = "ss_rt";   // ss = smartshala, rt = refresh token
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

// Frontend and backend are served from different origins in production, so the
// refresh cookie must be SameSite=None to be sent on the cross-site /auth/refresh
// request. SameSite=None requires Secure=true. In local HTTP dev (COOKIE_SECURE
// =false) fall back to "lax", which works for the same-site localhost setup.
const SAME_SITE = env.COOKIE_SECURE ? "none" : "lax";

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: SAME_SITE,
    path: "/",             // available to /auth/refresh endpoint
    maxAge: REFRESH_TTL_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: SAME_SITE,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

// Browsers send the refresh token back in the httpOnly cookie. Native mobile
// clients have no cookie jar, so they post the token in the body instead.
export function getRefreshToken(req: {
  cookies?: Record<string, string>;
  body?: { refreshToken?: unknown };
}): string | undefined {
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const fromBody = req.body?.refreshToken;
  return typeof fromBody === "string" && fromBody.length > 0 ? fromBody : undefined;
}
