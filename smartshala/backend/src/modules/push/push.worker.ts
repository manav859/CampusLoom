import { LeaveStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../core/prisma.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { getTenantPrismaClient } from "../../tenant/prismaManager.js";
import { runWithTenant } from "../../tenant/tenantContext.js";
import { sortClassRecords } from "../../utils/sortClasses.js";
import { isPushConfigured } from "./fcm.js";
import { attendanceReminderPush, approverRoles, leavePendingReminderPush } from "./push.messages.js";
import { notifyUsers, userIdsWithRoles } from "./push.service.js";

/**
 * The two reminders nobody triggers by doing something: attendance still not
 * marked, and leave still waiting for a decision.
 *
 * One pass a day, at PUSH_REMINDER_HOUR on the server clock — the same clock
 * every other date in this codebase is read on. The tick is quarter-hourly so
 * that a deploy inside the reminder hour still lands the pass, and a date key
 * keeps it to once per day however often the process restarts.
 */

const TICK_INTERVAL_MS = 15 * 60 * 1000;

let lastRunDay: string | null = null;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Class teachers whose class has no attendance session for today. */
async function remindUnmarkedAttendance(schoolId: string) {
  const today = startOfToday();

  // Sunday is not a school day anywhere in this codebase, and a holiday locks
  // attendance outright, so neither can be "not marked yet".
  if (today.getDay() === 0) return;
  const holiday = await prisma.holiday.findFirst({
    where: { schoolId, date: today },
    select: { id: true }
  });
  if (holiday) return;

  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      classTeacherId: { not: null },
      students: { some: { isActive: true } },
      attendanceSessions: { none: { date: today } }
    },
    select: { name: true, section: true, classTeacherId: true }
  });
  if (classes.length === 0) return;

  const byTeacher = new Map<string, { name: string; section: string }[]>();
  for (const record of classes) {
    const teacherId = record.classTeacherId!;
    byTeacher.set(teacherId, [...(byTeacher.get(teacherId) ?? []), record]);
  }

  for (const [teacherId, taught] of byTeacher) {
    await notifyUsers(
      schoolId,
      [teacherId],
      attendanceReminderPush({
        classNames: sortClassRecords(taught).map((record) => `${record.name}-${record.section}`)
      })
    );
  }
}

/** Approvers, when something has been sitting in the queue. */
async function remindPendingLeave(schoolId: string) {
  const [count, oldest] = await Promise.all([
    prisma.leaveRequest.count({ where: { schoolId, status: LeaveStatus.PENDING } }),
    prisma.leaveRequest.findFirst({
      where: { schoolId, status: LeaveStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    })
  ]);
  if (count === 0 || !oldest) return;

  const recipients = await userIdsWithRoles(schoolId, approverRoles);
  await notifyUsers(schoolId, recipients, leavePendingReminderPush({ count, oldest: oldest.createdAt }));
}

async function runForCurrentTenant() {
  // Every tenant database holds exactly one school.
  const school = await prisma.school.findFirst({ select: { id: true } });
  if (!school) return;

  await remindUnmarkedAttendance(school.id);
  await remindPendingLeave(school.id);
}

export async function runReminderPass() {
  if (!isPushConfigured()) return;

  if (!isMasterDbConfigured()) {
    // Single-tenant deployment: the default client already points at the only
    // school there is.
    await runForCurrentTenant();
    return;
  }

  const schools = await masterPrisma.school.findMany({
    where: { isActive: true },
    select: { schoolId: true, schoolName: true, dbName: true, dbUrl: true }
  });

  // Sequentially on purpose. The VPS has one vCPU, and a reminder pass that
  // opens every tenant's pool at once would compete with live requests.
  for (const school of schools) {
    if (!school.dbUrl) continue;
    try {
      await runWithTenant(
        {
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          dbName: school.dbName,
          prisma: getTenantPrismaClient(school.dbUrl)
        },
        runForCurrentTenant
      );
    } catch (error) {
      logger.error({ err: error, schoolId: school.schoolId }, "Push reminder pass failed for a school");
    }
  }
}

export function startPushReminderWorker() {
  if (env.NODE_ENV === "test" || !env.BACKGROUND_WORKERS_ENABLED || !isPushConfigured()) return;

  const tick = () => {
    const now = new Date();
    if (now.getHours() !== env.PUSH_REMINDER_HOUR) return;

    const key = dayKey(now);
    if (lastRunDay === key) return;
    lastRunDay = key;

    void runReminderPass().catch((error) => logger.error({ err: error }, "Push reminder pass failed"));
  };

  tick();
  const timer = setInterval(tick, TICK_INTERVAL_MS);
  timer.unref?.();
}
