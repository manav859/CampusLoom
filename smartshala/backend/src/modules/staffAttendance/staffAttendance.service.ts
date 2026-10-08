import { LeaveStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** ON_BREAK: the day has started, no session is open, and it is not punched out. */
export type PunchState = "NOT_PUNCHED_IN" | "PUNCHED_IN" | "ON_BREAK" | "PUNCHED_OUT";

type Session = { startAt: Date; endAt: Date | null };
export type DayRecord = { punchInAt: Date; punchOutAt: Date | null; sessions?: Session[] };

const withSessions = { sessions: { orderBy: { startAt: "asc" } } } satisfies Prisma.StaffAttendanceInclude;

/**
 * A day's punches, as the apps show them. Worked time is the sum of the
 * sessions; the gaps between them are breaks. A day recorded before sessions
 * existed reads as one session from punch-in to punch-out.
 */
export function toStatus(record: DayRecord | null, now = new Date()) {
  if (!record) {
    return {
      state: "NOT_PUNCHED_IN" as PunchState,
      punchInAt: null,
      punchOutAt: null,
      workedMinutes: 0,
      workedSeconds: 0,
      breakMinutes: 0,
      currentSessionStartedAt: null,
      breakStartedAt: null,
      sessions: [] as Session[],
      serverTime: now
    };
  }

  const sessions: Session[] = record.sessions?.length
    ? record.sessions.map((session) => ({ startAt: session.startAt, endAt: session.endAt }))
    : [{ startAt: record.punchInAt, endAt: record.punchOutAt }];
  const open = sessions.find((session) => !session.endAt) ?? null;
  const last = sessions[sessions.length - 1];
  const state: PunchState = record.punchOutAt ? "PUNCHED_OUT" : open ? "PUNCHED_IN" : "ON_BREAK";

  const workedMs = sessions.reduce(
    (sum, session) => sum + Math.max(0, (session.endAt ?? now).getTime() - session.startAt.getTime()),
    0
  );
  let breakMs = 0;
  for (let index = 1; index < sessions.length; index++) {
    const previousEnd = sessions[index - 1].endAt;
    if (previousEnd) breakMs += Math.max(0, sessions[index].startAt.getTime() - previousEnd.getTime());
  }
  // A break still running counts up to now.
  if (state === "ON_BREAK" && last.endAt) breakMs += Math.max(0, now.getTime() - last.endAt.getTime());

  return {
    state,
    punchInAt: sessions[0].startAt,
    punchOutAt: record.punchOutAt,
    workedMinutes: Math.round(workedMs / 60000),
    workedSeconds: Math.floor(workedMs / 1000),
    breakMinutes: Math.round(breakMs / 60000),
    // The apps run their timer from these and serverTime, so it ticks without
    // asking the server every second.
    currentSessionStartedAt: open?.startAt ?? null,
    breakStartedAt: state === "ON_BREAK" ? last.endAt : null,
    sessions,
    serverTime: now
  };
}

/** Today's row for this user, locked for the rest of the transaction so two taps cannot both act on it. */
async function lockToday(tx: Prisma.TransactionClient, userId: string, date: Date) {
  // Found through Prisma, which matches the stored date the way every other
  // query does; locked by id, then read again now that nobody else can change it.
  const found = await tx.staffAttendance.findUnique({ where: { userId_date: { userId, date } }, select: { id: true } });
  if (!found) return null;
  await tx.$queryRaw`SELECT "id" FROM "staff_attendance" WHERE "id" = ${found.id}::uuid FOR UPDATE`;
  return tx.staffAttendance.findUniqueOrThrow({ where: { id: found.id }, include: withSessions });
}

function today(user: Express.UserContext) {
  const date = startOfToday();
  return prisma.staffAttendance.findUnique({
    where: { userId_date: { userId: user.id, date } },
    include: withSessions
  });
}

export async function getTodayStatus(user: Express.UserContext) {
  return { date: startOfToday(), ...toStatus(await today(user)) };
}

/**
 * Starts work: the first punch of the day, coming back from a break, or
 * punching in again after a punch-out that was a mistake.
 */
export async function punchIn(user: Express.UserContext) {
  const date = startOfToday();
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await lockToday(tx, user.id, date);
      if (!existing) {
        await tx.staffAttendance.create({
          data: { schoolId: user.schoolId, userId: user.id, date, punchInAt: now, sessions: { create: { startAt: now } } }
        });
        return;
      }
      if (toStatus(existing, now).state === "PUNCHED_IN") {
        throw new AppError(409, "You are already punched in.", "ALREADY_PUNCHED_IN");
      }
      await tx.staffAttendanceSession.create({ data: { attendanceId: existing.id, startAt: now } });
      await tx.staffAttendance.update({ where: { id: existing.id }, data: { punchOutAt: null } });
    });
  } catch (error) {
    // Two first punches racing: the unique day row lets one through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "You are already punched in.", "ALREADY_PUNCHED_IN");
    }
    throw error;
  }

  return getTodayStatus(user);
}

/** Pauses work without ending the day; punching in resumes it. */
export async function startBreak(user: Express.UserContext) {
  const date = startOfToday();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await lockToday(tx, user.id, date);
    const state = toStatus(existing, now).state;
    if (state === "NOT_PUNCHED_IN") throw new AppError(409, "You have not punched in today.", "NOT_PUNCHED_IN");
    if (state === "ON_BREAK") throw new AppError(409, "You are already on a break.", "ALREADY_ON_BREAK");
    if (state === "PUNCHED_OUT") throw new AppError(409, "You have punched out for the day.", "ALREADY_PUNCHED_OUT");
    await tx.staffAttendanceSession.updateMany({ where: { attendanceId: existing!.id, endAt: null }, data: { endAt: now } });
  });

  return getTodayStatus(user);
}

/** Ends the day. From a break, the day ends where the break began. */
export async function punchOut(user: Express.UserContext) {
  const date = startOfToday();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await lockToday(tx, user.id, date);
    const state = toStatus(existing, now).state;
    if (state === "NOT_PUNCHED_IN") throw new AppError(409, "You have not punched in today.", "NOT_PUNCHED_IN");
    if (state === "PUNCHED_OUT") throw new AppError(409, "You have already punched out today.", "ALREADY_PUNCHED_OUT");
    await tx.staffAttendanceSession.updateMany({ where: { attendanceId: existing!.id, endAt: null }, data: { endAt: now } });
    await tx.staffAttendance.update({ where: { id: existing!.id }, data: { punchOutAt: now } });
  });

  return getTodayStatus(user);
}

export async function getMyHistory(user: Express.UserContext, month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const from = new Date(year, monthIndex - 1, 1);
  const to = new Date(year, monthIndex, 1);

  const records = await prisma.staffAttendance.findMany({
    where: { userId: user.id, date: { gte: from, lt: to } },
    orderBy: { date: "desc" },
    include: withSessions
  });

  return {
    month,
    presentDays: records.length,
    records: records.map((record) => ({ date: record.date, ...toStatus(record) }))
  };
}

/** YYYY-MM-DD in server-local time — how punch and holiday dates are stored. */
function localDayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * One staff member's month, for the principal. Working days run from the month
 * start (or the day they joined) to today, minus Sundays and school holidays —
 * the days student attendance counts. A working day is present when punched,
 * leave when covered by approved leave, otherwise absent. Today only counts
 * once it is present or leave, because the day is not over.
 */
export async function getStaffMonthSummary(schoolId: string, userId: string, month: string, now = new Date()) {
  const staff = await prisma.user.findFirst({
    where: { id: userId, schoolId, role: { in: [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] } },
    select: { createdAt: true }
  });
  if (!staff) throw notFound("Staff member");

  const [year, monthIndex] = month.split("-").map(Number);
  const from = new Date(year, monthIndex - 1, 1);
  const to = new Date(year, monthIndex, 1);

  const [punches, holidays, leaves] = await Promise.all([
    prisma.staffAttendance.findMany({ where: { schoolId, userId, date: { gte: from, lt: to } }, select: { date: true } }),
    prisma.holiday.findMany({ where: { schoolId, date: { gte: from, lt: to } }, select: { date: true } }),
    // Leave days are stored at midnight UTC, so the overlap uses UTC month bounds.
    prisma.leaveRequest.findMany({
      where: {
        schoolId,
        userId,
        status: LeaveStatus.APPROVED,
        fromDate: { lt: new Date(Date.UTC(year, monthIndex, 1)) },
        toDate: { gte: new Date(Date.UTC(year, monthIndex - 1, 1)) }
      },
      select: { fromDate: true, toDate: true }
    })
  ]);

  const punched = new Set(punches.map((row) => localDayKey(row.date)));
  const holidayKeys = new Set(holidays.map((row) => localDayKey(row.date)));
  const leaveKeys = new Set<string>();
  for (const leave of leaves) {
    for (const day = new Date(leave.fromDate); day <= leave.toDate; day.setUTCDate(day.getUTCDate() + 1)) {
      leaveKeys.add(day.toISOString().slice(0, 10));
    }
  }

  const joined = new Date(staff.createdAt);
  joined.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let presentDays = 0;
  let leaveDays = 0;
  let absentDays = 0;
  for (const day = new Date(Math.max(from.getTime(), joined.getTime())); day < to && day <= today; day.setDate(day.getDate() + 1)) {
    const key = localDayKey(day);
    if (day.getDay() === 0 || holidayKeys.has(key)) continue;
    if (punched.has(key)) presentDays++;
    else if (leaveKeys.has(key)) leaveDays++;
    else if (day.getTime() !== today.getTime()) absentDays++;
  }

  const workingDays = presentDays + leaveDays + absentDays;
  return {
    month,
    workingDays,
    presentDays,
    leaveDays,
    absentDays,
    percentage: workingDays === 0 ? null : Math.round((presentDays / workingDays) * 100)
  };
}

type DayStatus = "NOT_PUNCHED_IN" | "ON_LEAVE" | "PRESENT";
const dayStatusOrder: Record<DayStatus, number> = { NOT_PUNCHED_IN: 0, ON_LEAVE: 1, PRESENT: 2 };

/**
 * Every active teacher's punch for one day, for the principal. A punch wins
 * over leave, as in the month summary. Teachers who have not punched in come
 * first, because they are who the principal is looking for.
 */
export async function getStaffDay(schoolId: string, date: string, now = new Date()) {
  const [year, monthIndex, dayOfMonth] = date.split("-").map(Number);
  const from = new Date(year, monthIndex - 1, dayOfMonth);
  const to = new Date(year, monthIndex - 1, dayOfMonth + 1);
  // Leave days are stored at midnight UTC.
  const leaveDay = new Date(Date.UTC(year, monthIndex - 1, dayOfMonth));

  const [teachers, punches, leaves, holiday] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: UserRole.TEACHER, isActive: true },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: "asc" }
    }),
    prisma.staffAttendance.findMany({ where: { schoolId, date: { gte: from, lt: to } }, include: withSessions }),
    prisma.leaveRequest.findMany({
      where: { schoolId, status: LeaveStatus.APPROVED, fromDate: { lte: leaveDay }, toDate: { gte: leaveDay } },
      select: { userId: true, type: true }
    }),
    prisma.holiday.findFirst({ where: { schoolId, date: { gte: from, lt: to } }, select: { reason: true } })
  ]);

  const punchByUser = new Map(punches.map((row) => [row.userId, row]));
  const leaveByUser = new Map(leaves.map((row) => [row.userId, row.type]));

  const staff = teachers
    .map((teacher) => {
      const punch = punchByUser.get(teacher.id);
      const leaveType = leaveByUser.get(teacher.id) ?? null;
      const status: DayStatus = punch ? "PRESENT" : leaveType ? "ON_LEAVE" : "NOT_PUNCHED_IN";
      const worked = punch ? toStatus(punch, now) : null;
      return {
        ...teacher,
        status,
        leaveType: status === "ON_LEAVE" ? leaveType : null,
        punchInAt: worked?.punchInAt ?? null,
        punchOutAt: worked?.punchOutAt ?? null,
        onBreak: worked?.state === "ON_BREAK",
        // A punch still open on a past day has no end, so its hours are unknown.
        workedMinutes: worked && (worked.punchOutAt || localDayKey(now) === date) ? worked.workedMinutes : null
      };
    })
    .sort((a, b) => dayStatusOrder[a.status] - dayStatusOrder[b.status]);

  const count = (status: DayStatus) => staff.filter((row) => row.status === status).length;
  return {
    date,
    isSunday: from.getDay() === 0,
    holiday: holiday?.reason ?? null,
    total: staff.length,
    present: count("PRESENT"),
    onLeave: count("ON_LEAVE"),
    notPunchedIn: count("NOT_PUNCHED_IN"),
    staff
  };
}
