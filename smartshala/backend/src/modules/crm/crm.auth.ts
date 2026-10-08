import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { CrmRole } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../config/logger.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { maskIdentifier } from "../../utils/maskSensitive.js";
import { loginSuperAdmin } from "../superAdmin/superAdmin.service.js";
import type { CrmActor } from "./crm.shared.js";

const COOKIE_NAME = "ss_crm";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
// Mirrors the super admin cookie: cross-site in production, lax for local HTTP.
const SAME_SITE = env.COOKIE_SECURE ? "none" : "lax";
/** The super admin has no crm_users row; this stands in for its id in the token. */
const SUPER_ADMIN_SUBJECT = "super-admin";

type CrmTokenPayload = { kind: "CRM"; sub: string };

function signToken(subject: string) {
  return jwt.sign({ kind: "CRM" }, env.JWT_ACCESS_SECRET, { expiresIn: "12h", subject });
}

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: SAME_SITE,
  path: "/",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
} as const;

export function setCrmCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
}

export function clearCrmCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export function getCrmCookie(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}

/**
 * Who a token belongs to, re-read on every request: deactivating a salesperson
 * or changing their role takes effect at once, not when the token expires.
 */
async function actorForToken(token: string): Promise<CrmActor> {
  let payload: CrmTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as CrmTokenPayload;
  } catch {
    throw new AppError(401, "Invalid or expired session", "INVALID_CRM_TOKEN");
  }
  if (payload.kind !== "CRM" || !payload.sub) throw new AppError(401, "Invalid or expired session", "INVALID_CRM_TOKEN");

  if (payload.sub === SUPER_ADMIN_SUBJECT) return { id: null, name: "Super admin", role: CrmRole.ADMIN };

  const user = await masterPrisma.crmUser.findUnique({ where: { id: payload.sub } });
  if (!user?.isActive) throw new AppError(401, "This account is no longer active", "CRM_USER_INACTIVE");
  return { id: user.id, name: user.name, role: user.role };
}

function session(token: string, actor: CrmActor) {
  return { accessToken: token, user: actor };
}

export async function loginCrm(email: string, password: string, requestIp: string) {
  const normalized = email.trim().toLowerCase();

  // The platform super admin uses its own credentials and is an admin here.
  if (env.SUPER_ADMIN_EMAIL && normalized === env.SUPER_ADMIN_EMAIL.toLowerCase()) {
    await loginSuperAdmin(email, password, requestIp);
    const token = signToken(SUPER_ADMIN_SUBJECT);
    return session(token, await actorForToken(token));
  }

  const user = await masterPrisma.crmUser.findUnique({ where: { email: normalized } });
  const valid = user?.isActive ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    logger.warn({ evt: "auth.crm.login", outcome: "failure", email: maskIdentifier(normalized), ip: requestIp });
    throw new AppError(401, "Invalid email or password", "INVALID_CRM_CREDENTIALS");
  }

  await masterPrisma.crmUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  logger.info({ evt: "auth.crm.login", outcome: "success", email: maskIdentifier(normalized), ip: requestIp });
  return session(signToken(user.id), { id: user.id, name: user.name, role: user.role });
}

/** Restore the in-memory token after a page refresh, from the httpOnly cookie. */
export async function refreshCrmSession(token: string | undefined) {
  if (!token) throw new AppError(401, "No CRM session", "CRM_SESSION_MISSING");
  const actor = await actorForToken(token);
  const payload = jwt.decode(token) as CrmTokenPayload;
  return session(signToken(payload.sub), actor);
}

export function requireCrmUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new AppError(401, "Missing bearer token", "CRM_AUTH_REQUIRED"));
    return;
  }
  actorForToken(token)
    .then((actor) => {
      res.locals.crmActor = actor;
      next();
    })
    .catch(next);
}

export function requireCrmAdmin(_req: Request, res: Response, next: NextFunction) {
  if (crmActor(res).role !== CrmRole.ADMIN) {
    next(new AppError(403, "Only a sales admin can do this", "CRM_ADMIN_REQUIRED"));
    return;
  }
  next();
}

export function crmActor(res: Response): CrmActor {
  return res.locals.crmActor as CrmActor;
}
