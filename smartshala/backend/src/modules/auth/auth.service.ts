import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NotificationKind, NotificationStatus, UserRole, UserStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";
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

function signRefreshToken(user: TokenUser) {
  const options: jwt.SignOptions = { subject: user.id, expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ schoolId: user.schoolId }, env.JWT_REFRESH_SECRET, options);
}

function publicUser(user: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
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
      tokenHash: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user)
  };
}

export async function login(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim();
  const tenantContext = getTenantContext();

  if (tenantContext) {
    return loginWithClient(prisma, normalizedIdentifier, password, tenantContext.schoolId);
  }

  const tenant = await tenantForPublicLogin(normalizedIdentifier);
  if (tenant) {
    return loginWithClient(getTenantPrismaClient(tenant.dbUrl), normalizedIdentifier, password, tenant.schoolId);
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

  return loginWithClient(prisma, normalizedIdentifier, password);
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

  for (const school of schools) {
    const tenantPrisma = getTenantPrismaClient(school.dbUrl);
    const user = await tenantPrisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        status: UserStatus.ACTIVE,
        isActive: true
      },
      select: { id: true }
    });

    if (user) return school;
  }

  return null;
}

async function loginWithClient(client: PrismaClient, identifier: string, password: string, tenantSchoolId?: string) {
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
  const refreshToken = signRefreshToken(tokenUser);
  const tokenHash = await bcrypt.hash(refreshToken, 10);

  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user, effectiveTenantSchoolId)
  };
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

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: UserStatus.ACTIVE, isActive: true },
    include: { school: true }
  });

  if (!user) throw new AppError(401, "Current user is no longer active", "AUTH_REQUIRED");

  return publicUser(user);
}

export async function refresh(refreshToken: string) {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const userId = decoded.sub;
  if (!userId) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { refreshTokens: true, school: true } });
  if (!user || user.status !== UserStatus.ACTIVE || !user.isActive) {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const stored = await Promise.all(
    user.refreshTokens
      .filter((token) => !token.revokedAt && token.expiresAt > new Date())
      .map(async (token) => ((await bcrypt.compare(refreshToken, token.tokenHash)) ? token : null))
  );
  if (!stored.some(Boolean)) throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");

  return {
    accessToken: signAccessToken({
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      schoolName: user.school.name,
      tenantSchoolId: getTenantContext()?.schoolId ?? legacyTenantSchoolId(user.school)
    })
  };
}

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
