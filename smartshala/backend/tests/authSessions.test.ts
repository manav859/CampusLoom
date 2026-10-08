import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { prisma } from "../src/core/prisma.js";
import { logout, refresh } from "../src/modules/auth/auth.service.js";

/**
 * Sessions that stay signed in while they are used. Requires a reachable
 * database (DATABASE_URL). Tokens are minted here, backdated, rather than via
 * login, which needs the tenant registry.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const school = await prisma.school.create({ data: { name: "Session Test School", code: `ST-${randomUUID().slice(0, 8)}` } });
  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: "Session Teacher",
      phone: `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`,
      passwordHash: "x",
      role: "TEACHER"
    }
  });

  /** A refresh token issued `ageMs` ago, stored the way login stores one. */
  async function session(ageMs: number) {
    const issuedAt = Math.floor((Date.now() - ageMs) / 1000);
    const token = jwt.sign({ schoolId: school.id, iat: issuedAt }, env.JWT_REFRESH_SECRET, {
      subject: user.id,
      expiresIn: 30 * 24 * 60 * 60
    });
    const row = await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() - ageMs + 30 * DAY_MS) }
    });
    return { token, row };
  }

  try {
    // A fresh token is used as it is: no renewal inside the first day.
    const fresh = await session(60 * 1000);
    const quick = await refresh(fresh.token, true);
    assert.ok(quick.accessToken);
    assert.equal(quick.refreshToken, undefined);

    // An app session six days old — a week-long cut-off was near — is renewed.
    const old = await session(6 * DAY_MS);
    const renewed = await refresh(old.token, true);
    assert.ok(renewed.refreshToken, "a session in use gets a new refresh token");
    const newRow = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    assert.ok(newRow.expiresAt.getTime() > Date.now() + 29 * DAY_MS, "the app session now runs a month from today");

    // The old token still works for an hour, for requests already in flight...
    const oldRow = await prisma.refreshToken.findUniqueOrThrow({ where: { id: old.row.id } });
    assert.ok(oldRow.expiresAt.getTime() <= Date.now() + 60 * 60 * 1000 + 1000);
    assert.ok((await refresh(old.token, true)).accessToken);

    // ...and the new one works.
    assert.ok((await refresh(renewed.refreshToken!, true)).accessToken);

    // Sessions stored before the digest (bcrypt rows) keep working after deploy.
    const legacyToken = jwt.sign({ schoolId: school.id }, env.JWT_REFRESH_SECRET, { subject: user.id, expiresIn: 7 * 24 * 60 * 60 });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: await bcrypt.hash(legacyToken, 4), expiresAt: new Date(Date.now() + 7 * DAY_MS) }
    });
    assert.ok((await refresh(legacyToken, true)).accessToken, "a session from before this change stays signed in");

    // Signing out of one device leaves the other signed in.
    await logout(user.id, school.id, "test", fresh.token);
    await assert.rejects(refresh(fresh.token, true), (error: { code?: string }) => error.code === "INVALID_REFRESH_TOKEN");
    assert.ok((await refresh(renewed.refreshToken!, true)).accessToken, "the other session survives");

    console.log("authSessions: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
