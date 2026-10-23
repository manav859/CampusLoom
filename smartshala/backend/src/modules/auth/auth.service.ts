import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NotificationKind, NotificationStatus, UserRole, UserStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";
import { maskIdentifier } from "../../utils/maskSensitive.js";
import { normalizePhone, parentStudentWhere, studentMatchesPhone } from "../../utils/parentPhone.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { legacyTenantSchoolId } from "../../tenant/legacyTenant.js";
import { getTenantPrismaClient } from "../../tenant/prismaManager.js";
import { getTenantContext } from "../../tenant/tenantContext.js";

type TokenUser = {
  id: string;
  schoolId: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  schoolName: string;
  tenantSchoolId?: string;
};

type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
  schoolName?: string;
  schoolCode?: string;
  city?: string;
  state?: string;
};

function signAccessToken(user: TokenUser) {
  const options: jwt.SignOptions = { subject: user.id, expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] };
  return jwt.sign(
    {
      schoolId: user.schoolId,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      schoolName: user.schoolName,
      tenantSchoolId: user.tenantSchoolId
    },
    env.JWT_ACCESS_SECRET,
    options
  );
}

/**
 * How long a session lasts without being used. The apps get a month, so a
 * teacher is not signed out over a school break; the web keeps a week. Both
 * slide: a refresh more than a day after the token was issued renews it.
 */
const WEB_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MOBILE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;
/** A renewed token's predecessor keeps working this long, for requests already in flight. */
const SUPERSEDED_GRACE_MS = 60 * 60 * 1000;

export function sessionLengthMs(mobile: boolean) {
  return mobile ? MOBILE_SESSION_MS : WEB_SESSION_MS;
}

/**
 * Refresh tokens are stored as a SHA-256 of the whole token. They used to be
 * bcrypt hashes, but bcrypt reads only the first 72 bytes, and every refresh
 * JWT of one user shares those — so any of their tokens matched any of their
 * rows, and revoking one session did not reliably revoke it. A signed token is
 * long and random, so a fast digest is safe where a password would not be.
 */
function refreshTokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Rows written before the digest are bcrypt ("$2…") and still accepted until they expire. */
async function refreshTokenMatches(token: string, stored: string) {
  if (stored.startsWith("$2")) return bcrypt.compare(token, stored);
  const digest = Buffer.from(refreshTokenDigest(token));
  const expected = Buffer.from(stored);
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

function signRefreshToken(user: TokenUser, mobile = false) {
  const options: jwt.SignOptions = {
    subject: user.id,
    expiresIn: mobile ? Math.floor(MOBILE_SESSION_MS / 1000) : (env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"])
  };
  return jwt.sign({ schoolId: user.schoolId }, env.JWT_REFRESH_SECRET, options);
}

/**
 * Parents have no User row, so their refresh token is stateless: it carries
 * everything needed to re-mint an access token, marked with `pt` so refresh()
 * re-validates it against the student table instead of a User lookup.
 */
function signParentRefreshToken(user: TokenUser, mobile = false) {
  const options: jwt.SignOptions = {
    subject: user.id,
    expiresIn: mobile ? Math.floor(MOBILE_SESSION_MS / 1000) : (env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"])
  };
  return jwt.sign(
    {
      pt: true,
      schoolId: user.schoolId,
      tenantSchoolId: user.tenantSchoolId,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      schoolName: user.schoolName
    },
    env.JWT_REFRESH_SECRET,
    options
  );
}

/** The `user` payload for a parent session — shaped like publicUser, no User row behind it. */
function parentPublicUser(tokenUser: TokenUser) {
  return {
    id: tokenUser.id,
    name: tokenUser.fullName,
    fullName: tokenUser.fullName,
    email: null,
    phone: tokenUser.phone,
    role: tokenUser.role,
    schoolId: tokenUser.schoolId,
    schoolName: tokenUser.schoolName,
    tenantSchoolId: tokenUser.tenantSchoolId
  };
}

function publicUser(user: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  academicBackground: string | null;
  schoolId: string;
  school: { id: string; name: string; code?: string | null };
}, tenantSchoolId = getTenantContext()?.schoolId) {
  return {
    id: user.id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    academicBackground: user.academicBackground,
    schoolId: user.schoolId,
    schoolName: user.school.name,
    tenantSchoolId: tenantSchoolId ?? legacyTenantSchoolId(user.school)
  };
}

export function publicUserFromToken(user: Express.UserContext) {
  if (!user.schoolName) return null;

  return {
    id: user.id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? "",
    role: user.role,
    schoolId: user.schoolId,
    schoolName: user.schoolName,
    tenantSchoolId: user.tenantSchoolId
  };
}

function schoolCodeFrom(input: RegisterInput) {
  const base = (input.schoolCode ?? input.schoolName ?? input.email.split("@")[1] ?? input.name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "SMARTSHALA"}-${Date.now().toString(36).toUpperCase()}`;
}

export async function register(data: RegisterInput) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const requestedRole = data.role ?? UserRole.PRINCIPAL;

  const school = data.schoolCode
    ? await prisma.school.findUnique({ where: { code: data.schoolCode } })
    : await prisma.school.create({
        data: {
          name: data.schoolName ?? `${data.name}'s School`,
          code: schoolCodeFrom(data),
          city: data.city,
          state: data.state,
          phone: data.phone
        }
      });

  if (!school) throw new AppError(400, "School code does not exist", "INVALID_SCHOOL");

  const role =
    data.schoolCode || requestedRole === UserRole.PRINCIPAL || requestedRole === UserRole.ADMIN
      ? requestedRole
      : UserRole.PRINCIPAL;

  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role,
      isActive: true,
      status: UserStatus.ACTIVE
    },
    include: { school: true }
  });

  const tokenUser: TokenUser = {
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    schoolName: user.school.name,
    tenantSchoolId: getTenantContext()?.schoolId ?? legacyTenantSchoolId(user.school)
  };

  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenDigest(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user)
  };
}

export async function login(identifier: string, password: string, requestIp: string = "unknown", mobile = false) {
  const normalizedIdentifier = identifier.trim();

  try {
    const tenantContext = getTenantContext();

    if (tenantContext) {
      return await loginWithClient(prisma, normalizedIdentifier, password, tenantContext.schoolId, requestIp, mobile);
    }

    const tenant = await tenantForPublicLogin(normalizedIdentifier);
    if (tenant) {
      return await loginWithClient(getTenantPrismaClient(tenant.dbUrl), normalizedIdentifier, password, tenant.schoolId, requestIp, mobile);
    }

    // Check if the school exists but is inactive (pending approval)
    if (isMasterDbConfigured()) {
      const pendingSchool = await masterPrisma.school.findFirst({
        where: {
          OR: [{ email: normalizedIdentifier }, { phone: normalizedIdentifier }],
          isActive: false
        },
        select: { schoolId: true, paymentStatus: true, deletionStatus: true }
      });
      if (pendingSchool) {
        if (pendingSchool.deletionStatus === "DELETED") {
          throw new AppError(403, "This school has been deleted. Please contact support.", "SCHOOL_DELETED");
        }
        throw new AppError(403, "Your school activation is pending. Please wait for admin approval.", "ACTIVATION_PENDING");
      }
    }

    return await loginWithClient(prisma, normalizedIdentifier, password, undefined, requestIp, mobile);
  } catch (err) {
    logger.warn({
      evt: "auth.login",
      outcome: "failure",
      reason: err instanceof AppError ? err.code : "UNKNOWN",
      identifier: maskIdentifier(normalizedIdentifier),
      ip: requestIp,
      schoolId: getTenantContext()?.schoolId ?? null
    });
    throw err;
  }
}

async function tenantForPublicLogin(identifier: string) {
  if (!isMasterDbConfigured()) return null;

  const school = await masterPrisma.school.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
      isActive: true
    },
    select: {
      schoolId: true,
      dbUrl: true,
      isTrial: true,
      trialEndsAt: true
    }
  });

  const matchedSchool = school ?? await tenantForLoginUser(identifier);

  if (!matchedSchool) return null;

  const trialExpired = Boolean(matchedSchool.isTrial && matchedSchool.trialEndsAt && matchedSchool.trialEndsAt <= new Date());
  if (trialExpired) {
    throw new AppError(402, "School subscription is inactive or expired", "SCHOOL_INACTIVE");
  }

  return matchedSchool;
}

async function tenantForLoginUser(identifier: string) {
  const schools = await masterPrisma.school.findMany({
    where: { isActive: true },
    select: {
      schoolId: true,
      dbUrl: true,
      isTrial: true,
      trialEndsAt: true
    }
  });

  const checkSchool = async (school: typeof schools[number]) => {
    try {
      const tenantPrisma = getTenantPrismaClient(school.dbUrl);
      const user = await tenantPrisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
          status: UserStatus.ACTIVE,
          isActive: true
        },
        select: { id: true }
      });
      return user ? school : null;
    } catch (err) {
      console.warn(`[Login] Failed to query tenant database for school ${school.schoolId}:`, err);
      return null;
    }
  };

  const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  };

  // Run all active tenant database queries in parallel, capped at 4 seconds.
  // This prevents any slow/cold-starting database from stalling the entire login page.
  const promises = schools.map((school) => withTimeout(checkSchool(school), 4000, null));
  const results = await Promise.all(promises);

  return results.find((s) => s !== null) ?? null;
}

async function loginWithClient(
  client: PrismaClient,
  identifier: string,
  password: string,
  tenantSchoolId?: string,
  requestIp: string = "unknown",
  mobile = false
) {
  const user = await client.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
      status: UserStatus.ACTIVE,
      isActive: true
    },
    include: { school: true }
  });

  if (!user) throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  const effectiveTenantSchoolId = getTenantContext()?.schoolId
    ?? tenantSchoolId
    ?? legacyTenantSchoolId(user.school);

  const tokenUser: TokenUser = {
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    schoolName: user.school.name,
    tenantSchoolId: effectiveTenantSchoolId
  };
  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser, mobile);
  const tokenHash = refreshTokenDigest(refreshToken);

  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + sessionLengthMs(mobile))
    }
  });

  logger.info({
    evt: "auth.login",
    outcome: "success",
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId ?? null,
    ip: requestIp
  });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user, effectiveTenantSchoolId)
  };
}

/**
 * Parents sign in with their mobile number and a child's admission number.
 * There is no parent account: a login is a per-request check against the
 * student table — the admission number locates one student (it is unique per
 * school), and the mobile must match one of that student's guardian phones.
 * The matching school becomes the parent's tenant; a PARENT token is issued
 * with no User row and a stateless refresh token.
 */
export async function parentLogin(mobile: string, admissionNumber: string, requestIp: string = "unknown", mobileClient = false) {
  const normalizedMobile = normalizePhone(mobile);
  const admission = admissionNumber.trim();

  try {
    if (normalizedMobile.length < 10) {
      throw new AppError(401, "Invalid mobile number or admission number", "INVALID_CREDENTIALS");
    }

    const tenantContext = getTenantContext();
    if (tenantContext) {
      return await parentLoginWithClient(prisma, normalizedMobile, mobile, admission, tenantContext.schoolId, requestIp, mobileClient);
    }

    if (isMasterDbConfigured()) {
      const tenant = await tenantForParentLogin(admission, mobile);
      if (!tenant) throw new AppError(401, "Invalid mobile number or admission number", "INVALID_CREDENTIALS");
      return await parentLoginWithClient(getTenantPrismaClient(tenant.dbUrl), normalizedMobile, mobile, admission, tenant.schoolId, requestIp, mobileClient);
    }

    return await parentLoginWithClient(prisma, normalizedMobile, mobile, admission, undefined, requestIp, mobileClient);
  } catch (err) {
    logger.warn({
      evt: "auth.parentLogin",
      outcome: "failure",
      reason: err instanceof AppError ? err.code : "UNKNOWN",
      mobile: maskIdentifier(normalizedMobile),
      ip: requestIp
    });
    throw err;
  }
}

/** Finds the active tenant whose student has this admission number and a matching guardian phone. */
async function tenantForParentLogin(admissionNumber: string, mobile: string) {
  const schools = await masterPrisma.school.findMany({
    where: { isActive: true },
    select: { schoolId: true, dbUrl: true, isTrial: true, trialEndsAt: true }
  });

  const checkSchool = async (school: typeof schools[number]) => {
    try {
      const tenantPrisma = getTenantPrismaClient(school.dbUrl);
      const student = await tenantPrisma.student.findFirst({
        where: { admissionNumber, isActive: true },
        select: { parentPhone: true, alternatePhone: true, fatherPhone: true, motherPhone: true, guardianPhone: true }
      });
      return student && studentMatchesPhone(student, mobile) ? school : null;
    } catch (err) {
      console.warn(`[ParentLogin] Failed to query tenant database for school ${school.schoolId}:`, err);
      return null;
    }
  };

  const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

  const results = await Promise.all(schools.map((school) => withTimeout(checkSchool(school), 4000, null)));
  const matched = results.find((s) => s !== null);
  if (!matched) return null;

  const trialExpired = Boolean(matched.isTrial && matched.trialEndsAt && matched.trialEndsAt <= new Date());
  if (trialExpired) throw new AppError(402, "School subscription is inactive or expired", "SCHOOL_INACTIVE");

  return matched;
}

async function parentLoginWithClient(
  client: PrismaClient,
  normalizedMobile: string,
  rawMobile: string,
  admissionNumber: string,
  tenantSchoolId?: string,
  requestIp: string = "unknown",
  mobileClient = false
) {
  const student = await client.student.findFirst({
    where: { admissionNumber, isActive: true },
    include: { school: true }
  });

  if (!student || !studentMatchesPhone(student, rawMobile)) {
    throw new AppError(401, "Invalid mobile number or admission number", "INVALID_CREDENTIALS");
  }

  const effectiveTenantSchoolId = getTenantContext()?.schoolId ?? tenantSchoolId ?? legacyTenantSchoolId(student.school);

  const tokenUser: TokenUser = {
    id: `parent:${normalizedMobile}`,
    schoolId: student.schoolId,
    role: UserRole.PARENT,
    fullName: student.parentName || "Parent",
    phone: normalizedMobile,
    email: null,
    schoolName: student.school.name,
    tenantSchoolId: effectiveTenantSchoolId
  };

  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signParentRefreshToken(tokenUser, mobileClient);

  logger.info({
    evt: "auth.parentLogin",
    outcome: "success",
    schoolId: student.schoolId,
    ip: requestIp
  });

  return { accessToken, refreshToken, user: parentPublicUser(tokenUser) };
}

export async function forgotPassword(identifier: string) {
  const normalizedIdentifier = identifier.trim();

  const tenantContext = getTenantContext();
  if (tenantContext) {
    const user = await recordPasswordResetRequestForClient(prisma, tenantContext.schoolId, normalizedIdentifier);
    if (user) await queueTenantPasswordResetNotification(user);
    return passwordResetResponse();
  }

  const found = await findUserForPublicPasswordReset(normalizedIdentifier);
  if (found) {
    await recordPasswordResetRequest(found, normalizedIdentifier);
  }

  return passwordResetResponse();
}

function passwordResetResponse() {
  return {
    message: "If this account exists, a password reset request has been recorded. SmartShala support will verify and contact the school administrator.",
    supportPhone: "+91-98765-43210",
    supportEmail: "support@smartshala.in"
  };
}

async function queueTenantPasswordResetNotification(user: {
  schoolId: string;
  fullName: string;
  phone: string;
}) {
  await prisma.notification.create({
    data: {
      schoolId: user.schoolId,
      kind: NotificationKind.SCHOOL_ALERT,
      recipientPhone: user.phone,
      message: `Password reset requested for ${user.fullName}. SmartShala support will verify the requester before changing login credentials.`,
      status: NotificationStatus.QUEUED
    }
  }).catch(() => undefined);
}

async function recordPasswordResetRequestForClient(client: PrismaClient, tenantSchoolId: string, identifier: string) {
  const user = await client.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
      status: UserStatus.ACTIVE,
      isActive: true
    },
    include: { school: true }
  });

  if (!user) return null;
  await recordPasswordResetRequest(
    {
      tenantSchoolId,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    },
    identifier
  );
  return user;
}

async function findUserForPublicPasswordReset(identifier: string) {
  if (!isMasterDbConfigured()) return null;

  const schools = await masterPrisma.school.findMany({
    where: { isActive: true },
    select: { schoolId: true, dbUrl: true }
  });

  for (const school of schools) {
    const tenantPrisma = getTenantPrismaClient(school.dbUrl);
    const user = await tenantPrisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        status: UserStatus.ACTIVE,
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true
      }
    });

    if (user) return { tenantSchoolId: school.schoolId, user };
  }

  return null;
}

async function recordPasswordResetRequest(
  found: {
    tenantSchoolId: string;
    user: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string;
      role: UserRole;
    };
  } | null,
  identifier: string
) {
  if (!found || !isMasterDbConfigured()) return;

  await masterPrisma.passwordResetRequest.create({
      data: {
      schoolId: found.tenantSchoolId,
      userId: found.user.id,
      userName: found.user.fullName,
      email: found.user.email,
      phone: found.user.phone,
      role: found.user.role,
      identifier
      }
  });
}

export async function getCurrentUser(user: Express.UserContext) {
  // A parent has no User row: the session is rebuilt from the token and
  // confirmed only by the presence of at least one of their active children.
  if (user.role === UserRole.PARENT) {
    const child = await prisma.student.findFirst({
      where: { ...parentStudentWhere(user.phone ?? ""), isActive: true },
      select: { id: true }
    });
    if (!child) throw new AppError(401, "No active student is linked to this parent", "AUTH_REQUIRED");
    return {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: null,
      phone: user.phone ?? "",
      role: user.role,
      schoolId: user.schoolId,
      schoolName: user.schoolName ?? "",
      tenantSchoolId: user.tenantSchoolId
    };
  }

  const found = await prisma.user.findFirst({
    where: { id: user.id, status: UserStatus.ACTIVE, isActive: true },
    include: { school: true }
  });

  if (!found) throw new AppError(401, "Current user is no longer active", "AUTH_REQUIRED");

  return publicUser(found);
}

/**
 * Renews a parent session without a User row or a stored refresh row. The token
 * is trusted only while at least one of the parent's children is still enrolled;
 * the session slides the same way a staff session does.
 */
async function refreshParent(decoded: jwt.JwtPayload, mobileClient: boolean) {
  const subject = typeof decoded.sub === "string" ? decoded.sub : "";
  const phone = typeof decoded.phone === "string" ? decoded.phone : "";
  if (!subject || !phone) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  const stillEnrolled = await prisma.student.findFirst({
    where: { ...parentStudentWhere(phone), isActive: true },
    select: { id: true }
  });
  if (!stillEnrolled) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  const tokenUser: TokenUser = {
    id: subject,
    schoolId: typeof decoded.schoolId === "string" ? decoded.schoolId : "",
    role: UserRole.PARENT,
    fullName: typeof decoded.fullName === "string" ? decoded.fullName : "Parent",
    phone,
    email: null,
    schoolName: typeof decoded.schoolName === "string" ? decoded.schoolName : "",
    tenantSchoolId: typeof decoded.tenantSchoolId === "string" ? decoded.tenantSchoolId : getTenantContext()?.schoolId
  };

  const issuedAt = typeof decoded.iat === "number" ? decoded.iat * 1000 : 0;
  const renewed = Date.now() - issuedAt > RENEW_AFTER_MS ? signParentRefreshToken(tokenUser, mobileClient) : undefined;

  return { accessToken: signAccessToken(tokenUser), refreshToken: renewed };
}

export async function refresh(refreshToken: string, mobile = false) {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const userId = decoded.sub;
  if (!userId) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  if (decoded.pt) return refreshParent(decoded, mobile);

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { refreshTokens: true, school: true } });
  if (!user || user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const stored = await Promise.all(
    user.refreshTokens
      .filter((token) => !token.revokedAt && token.expiresAt > new Date())
      .map(async (token) => ((await refreshTokenMatches(refreshToken, token.tokenHash)) ? token : null))
  );
  const current = stored.find(Boolean);
  if (!current) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  const tokenUser: TokenUser = {
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    schoolName: user.school.name,
    tenantSchoolId: getTenantContext()?.schoolId ?? legacyTenantSchoolId(user.school)
  };

  // A session in use is renewed, so it ends only after a stretch of not being
  // used, not a fixed week after sign-in whatever the person was doing.
  const issuedAt = typeof decoded.iat === "number" ? decoded.iat * 1000 : 0;
  let renewed: string | undefined;
  if (Date.now() - issuedAt > RENEW_AFTER_MS) {
    const now = Date.now();
    renewed = signRefreshToken(tokenUser, mobile);
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshTokenDigest(renewed), expiresAt: new Date(now + sessionLengthMs(mobile)) }
    });
    await prisma.refreshToken.update({
      where: { id: current.id },
      data: { expiresAt: new Date(Math.min(current.expiresAt.getTime(), now + SUPERSEDED_GRACE_MS)) }
    });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date(now) } } });
  }

  return { accessToken: signAccessToken(tokenUser), refreshToken: renewed };
}

/**
 * Ends the session that asked. Signing out of the web must not sign the same
 * person out of the app on their phone, so only the presented refresh token is
 * revoked; without one, every session goes, as before.
 */
export async function logout(userId: string, schoolId: string | null = null, requestIp: string = "unknown", refreshToken?: string) {
  const open = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
  const matching = refreshToken
    ? (await Promise.all(open.map(async (token) => ((await refreshTokenMatches(refreshToken, token.tokenHash)) ? token.id : null)))).filter(
        (id): id is string => id !== null
      )
    : [];
  await prisma.refreshToken.updateMany({
    where: matching.length ? { id: { in: matching } } : { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  logger.info({
    evt: "auth.logout",
    userId,
    schoolId: schoolId ?? null,
    ip: requestIp
  });
}

export async function updateProfile(userId: string, data: { fullName?: string; email?: string; phone?: string; academicBackground?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  if (!user) throw new AppError(404, "User not found", "NOT_FOUND");

  // Check email/phone uniqueness if they are changing
  if (data.email && data.email !== user.email) {
    const existingEmail = await prisma.user.findFirst({ where: { schoolId: user.schoolId, email: data.email, id: { not: userId } } });
    if (existingEmail) throw new AppError(409, "Email is already in use by another user.", "EMAIL_IN_USE");
  }
  if (data.phone && data.phone !== user.phone) {
    const existingPhone = await prisma.user.findFirst({ where: { schoolId: user.schoolId, phone: data.phone, id: { not: userId } } });
    if (existingPhone) throw new AppError(409, "Phone number is already in use by another user.", "PHONE_IN_USE");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName ?? user.fullName,
      email: data.email === "" ? null : (data.email ?? user.email),
      phone: data.phone ?? user.phone,
      academicBackground: data.academicBackground === "" ? null : (data.academicBackground ?? user.academicBackground)
    },
    include: { school: true }
  });

  return { user: publicUser(updatedUser) };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found", "NOT_FOUND");

  const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validPassword) throw new AppError(401, "Incorrect current password", "INVALID_CREDENTIALS");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
}
