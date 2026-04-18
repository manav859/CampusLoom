import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";

type TokenUser = {
  id: string;
  schoolId: string;
  role: "ADMIN" | "TEACHER";
  fullName: string;
};

function signAccessToken(user: TokenUser) {
  const options: jwt.SignOptions = { subject: user.id, expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] };
  return jwt.sign(
    { schoolId: user.schoolId, role: user.role, fullName: user.fullName },
    env.JWT_ACCESS_SECRET,
    options
  );
}

function signRefreshToken(user: TokenUser) {
  const options: jwt.SignOptions = { subject: user.id, expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ schoolId: user.schoolId }, env.JWT_REFRESH_SECRET, options);
}

export async function login(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
      status: UserStatus.ACTIVE
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
    fullName: user.fullName
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
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId,
      schoolName: user.school.name
    }
  };
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
  if (!user || user.status !== UserStatus.ACTIVE) {
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
      fullName: user.fullName
    })
  };
}

export async function logout(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
