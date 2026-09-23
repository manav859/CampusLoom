import { LeaveStatus, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

type PunchState = "NOT_PUNCHED_IN" | "PUNCHED_IN" | "PUNCHED_OUT";

function toStatus(record: { punchInAt: Date; punchOutAt: Date | null } | null, now = new Date()) {
  if (!record) return { state: "NOT_PUNCHED_IN" as PunchState, punchInAt: null, punchOutAt: null, workedMinutes: 0 };

  const state: PunchState = record.punchOutAt ? "PUNCHED_OUT" : "PUNCHED_IN";
  const until = record.punchOutAt ?? now;
  const workedMinutes = Math.max(0, Math.round((until.getTime() - record.punchInAt.getTime()) / 60000));

  return { state, punchInAt: record.punchInAt, punchOutAt: record.punchOutAt, workedMinutes };
}

export async function getTodayStatus(user: Express.UserContext) {
  const date = startOfToday();
  const record = await prisma.staffAttendance.findUnique({
    where: { userId_date: { userId: user.id, date } }
  });

  return { date, ...toStatus(record) };
}

export async function punchIn(user: Express.UserContext) {
  const date = startOfToday();
  const existing = await prisma.staffAttendance.findUnique({
    where: { userId_date: { userId: user.id, date } }
  });

  if (existing) {
    throw new AppError(
      409,
      existing.punchOutAt ? "You have already completed today's punch." : "You are already punched in.",
      existing.punchOutAt ? "ALREADY_PUNCHED_OUT" : "ALREADY_PUNCHED_IN"
    );
  }

  const record = await prisma.staffAttendance.create({
    data: { schoolId: user.schoolId, userId: user.id, date, punchInAt: new Date() }
  });

  return { date, ...toStatus(record) };
}

export async function punchOut(user: Express.UserContext) {
  const date = startOfToday();
  const existing = await prisma.staffAttendance.findUnique({
    where: { userId_date: { userId: user.id, date } }
  });

  if (!existing) throw new AppError(409, "You have not punched in today.", "NOT_PUNCHED_IN");
  if (existing.punchOutAt) throw new AppError(409, "You have already punched out today.", "ALREADY_PUNCHED_OUT");

  const record = await prisma.staffAttendance.update({
    where: { id: existing.id },
    data: { punchOutAt: new Date() }
  });

  return { date, ...toStatus(record) };
}

export async function getMyHistory(user: Express.UserContext, month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const from = new Date(year, monthIndex - 1, 1);
  const to = new Date(year, monthIndex, 1);

  const records = await prisma.staffAttendance.findMany({
    where: { userId: user.id, date: { gte: from, lt: to } },
    orderBy: { date: "desc" }
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
    prisma.staffAttendance.findMany({ where: { schoolId, date: { gte: from, lt: to } } }),
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
