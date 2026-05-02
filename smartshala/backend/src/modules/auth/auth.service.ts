import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole, UserStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";

type TokenUser = {
  id: string;
  schoolId: string;
  role: UserRole;
  fullName: string;
  phone: string;
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
    { schoolId: user.schoolId, role: user.role, fullName: user.fullName, phone: user.phone },
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
  school: { name: string };
}) {
  return {
    id: user.id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    schoolId: user.schoolId,
    schoolName: user.school.name
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
    phone: user.phone
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
  const user = await prisma.user.findFirst({
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

  const tokenUser: TokenUser = {
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone
  };
  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser);
  const tokenHash = await bcrypt.hash(refreshToken, 10);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user)
  };
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

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { refreshTokens: true } });
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
      phone: user.phone
    })
  };
}

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
