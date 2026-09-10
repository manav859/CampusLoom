import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

type PunchState = "NOT_PUNCHED_IN" | "PUNCHED_IN" | "PUNCHED_OUT";

function toStatus(record: { punchInAt: Date; punchOutAt: Date | null } | null) {
  if (!record) return { state: "NOT_PUNCHED_IN" as PunchState, punchInAt: null, punchOutAt: null, workedMinutes: 0 };

  const state: PunchState = record.punchOutAt ? "PUNCHED_OUT" : "PUNCHED_IN";
  const until = record.punchOutAt ?? new Date();
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
