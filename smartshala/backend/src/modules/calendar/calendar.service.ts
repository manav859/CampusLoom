import { CalendarEvent, CalendarEventType, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const editorRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);

type CalendarEventInput = {
  type: CalendarEventType;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
};

/** Midnight UTC, so an event day is not shifted by the server timezone. */
function parseDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Holidays predate this module and are stored at the server's local midnight
 * (attendance.service `startOfDay`), so they are read back in local time —
 * the same way the attendance screens format them.
 */
function formatLocalDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function assertEditor(user: Express.UserContext) {
  if (!editorRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can change the calendar.", "FORBIDDEN");
  }
}

function toData(input: CalendarEventInput) {
  const startDate = input.startDate;
  const endDate = input.endDate ?? input.startDate;
  if (endDate < startDate) {
    throw new AppError(400, "The end date cannot be before the start date.", "INVALID_DATE_RANGE");
  }

  return {
    type: input.type,
    title: input.title,
    description: input.description || null,
    startDate: parseDay(startDate),
    endDate: parseDay(endDate)
  };
}

function toItem(row: CalendarEvent) {
  return {
    id: row.id,
    source: "EVENT" as const,
    type: row.type as CalendarEventType | "HOLIDAY",
    title: row.title,
    description: row.description,
    startDate: formatUtcDay(row.startDate),
    endDate: formatUtcDay(row.endDate)
  };
}

/**
 * Everything on the school calendar for one month: calendar events that
 * overlap it, plus the attendance holidays, merged into a single list sorted
 * by start date. Dates are plain YYYY-MM-DD strings so no client has to
 * reason about timezones.
 */
export async function listMonth(user: Express.UserContext, month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));

  const [events, holidays] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        schoolId: user.schoolId,
        startDate: { lte: last },
        endDate: { gte: first }
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }]
    }),
    prisma.holiday.findMany({
      where: {
        schoolId: user.schoolId,
        date: {
          gte: new Date(year, monthNumber - 1, 1),
          lte: new Date(year, monthNumber, 0, 23, 59, 59, 999)
        }
      },
      orderBy: { date: "asc" }
    })
  ]);

  const items = [
    ...events.map(toItem),
    ...holidays.map((holiday) => {
      const date = formatLocalDay(holiday.date);
      return {
        id: holiday.id,
        source: "HOLIDAY" as const,
        type: "HOLIDAY" as const,
        title: holiday.reason,
        description: null,
        startDate: date,
        endDate: date
      };
    })
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return { month, items };
}

export async function createEvent(user: Express.UserContext, input: CalendarEventInput) {
  assertEditor(user);

  const created = await prisma.calendarEvent.create({
    data: { ...toData(input), schoolId: user.schoolId, createdById: user.id }
  });
  return toItem(created);
}

export async function updateEvent(user: Express.UserContext, id: string, input: CalendarEventInput) {
  assertEditor(user);
  const data = toData(input);

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true }
  });
  if (!existing) throw notFound("Calendar event");

  const updated = await prisma.calendarEvent.update({ where: { id: existing.id }, data });
  return toItem(updated);
}

export async function deleteEvent(user: Express.UserContext, id: string) {
  assertEditor(user);

  const { count } = await prisma.calendarEvent.deleteMany({
    where: { id, schoolId: user.schoolId }
  });
  if (count === 0) throw notFound("Calendar event");
}
