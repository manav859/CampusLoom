import { DevicePlatform, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { logger } from "../../config/logger.js";
import { isPushConfigured, sendToDevice, type PushPayload } from "./fcm.js";

/**
 * Device registration and delivery. Everything a feature module needs is in
 * `push.events.ts`; this file only knows about registrations and users.
 */

/** Sent in parallel, but not all at once: one school can have hundreds of devices. */
const SEND_CONCURRENCY = 8;

export async function registerDevice(
  user: Express.UserContext,
  input: { fid: string; platform: DevicePlatform }
) {
  // The FID is the device. Reassigning it on conflict is what stops the last
  // person to sign in on a shared staffroom phone from keeping its
  // notifications — and it is also the plain re-registration path, which every
  // app start takes.
  await prisma.deviceRegistration.upsert({
    where: { fid: input.fid },
    create: {
      schoolId: user.schoolId,
      userId: user.id,
      fid: input.fid,
      platform: input.platform
    },
    update: {
      schoolId: user.schoolId,
      userId: user.id,
      platform: input.platform,
      lastSeenAt: new Date()
    }
  });

  return { registered: true };
}

/** Sign-out. Scoped to the caller so one user cannot drop another's device. */
export async function unregisterDevice(user: Express.UserContext, fid: string) {
  const { count } = await prisma.deviceRegistration.deleteMany({
    where: { fid, userId: user.id, schoolId: user.schoolId }
  });
  return { removed: count > 0 };
}

/** Active users in the school holding any of these roles. */
export async function userIdsWithRoles(
  schoolId: string,
  roles: UserRole[],
  options: { exclude?: string } = {}
) {
  if (roles.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      schoolId,
      role: { in: roles },
      isActive: true,
      ...(options.exclude ? { id: { not: options.exclude } } : {})
    },
    select: { id: true }
  });

  return users.map((user) => user.id);
}

/**
 * Delivers one notification to every device the given users have registered.
 * Registrations FCM rejects outright are deleted, which is the only garbage
 * collection the table gets — an uninstalled app never tells us it is gone.
 */
export async function notifyUsers(schoolId: string, userIds: string[], payload: PushPayload) {
  if (!isPushConfigured() || userIds.length === 0) return { sent: 0, pruned: 0 };

  const devices = await prisma.deviceRegistration.findMany({
    where: { schoolId, userId: { in: userIds } },
    select: { fid: true }
  });
  if (devices.length === 0) return { sent: 0, pruned: 0 };

  const stale: string[] = [];
  let sent = 0;

  for (let index = 0; index < devices.length; index += SEND_CONCURRENCY) {
    const batch = devices.slice(index, index + SEND_CONCURRENCY);
    const outcomes = await Promise.all(batch.map((device) => sendToDevice(device.fid, payload)));

    outcomes.forEach((outcome, position) => {
      if (outcome === "sent") sent += 1;
      if (outcome === "stale") stale.push(batch[position].fid);
    });
  }

  if (stale.length > 0) {
    await prisma.deviceRegistration.deleteMany({ where: { fid: { in: stale } } });
  }

  logger.info(
    { evt: "push.sent", kind: payload.data.kind, recipients: userIds.length, sent, pruned: stale.length },
    "Push notification dispatched"
  );

  return { sent, pruned: stale.length };
}

/**
 * Runs a notification after the response has gone out. A push is never worth
 * failing or delaying the action that triggered it, so this swallows its own
 * errors — the same shape the WhatsApp queue uses.
 *
 * AsyncLocalStorage carries the tenant Prisma client into the callback, so a
 * dispatch from a request still reads and writes that school's database.
 */
export function dispatch(task: () => Promise<unknown>) {
  if (!isPushConfigured()) return;

  setImmediate(() => {
    void task().catch((error) => {
      logger.warn({ err: error }, "Push notification task failed");
    });
  });
}
