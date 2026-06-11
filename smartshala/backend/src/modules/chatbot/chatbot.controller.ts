import type { Request, Response } from "express";
import { InstallmentStatus } from "@prisma/client";
import { asyncHandler } from "../../core/asyncHandler.js";
import { prisma } from "../../core/prisma.js";
import { askSchema } from "./chatbot.schemas.js";
import { streamChat } from "./chatbot.service.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pulls a small, relevant slice of tenant ERP data based on simple keyword
 * intent detection. Returns a plain-text block to feed the model as [ERP DATA],
 * or null when the question needs no school data. Every query is best-effort:
 * any failure returns null so the chat still works without context.
 *
 * Data is provided as aggregate summaries (counts/totals), never per-student
 * lists — keeps token usage low and avoids leaking long name lists into chat.
 *
 * The `prisma` proxy is already bound to the request's tenant DB via the
 * tenant AsyncLocalStorage context, so filtering by schoolId is sufficient.
 */
async function buildErpContext(
  message: string,
  schoolId: string,
  role: string,
  req: Request
): Promise<string | null> {
  const text = message.toLowerCase();

  try {
    if (text.includes("attendance")) {
      // Summarize the most recent marked day (covers "today" once attendance
      // is marked; otherwise the date label tells the model which day it is).
      const latest = await prisma.attendanceSession.findFirst({
        where: { schoolId },
        orderBy: { date: "desc" },
        select: { date: true }
      });
      if (!latest) return null;

      const dayStart = new Date(latest.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const grouped = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { schoolId, session: { date: { gte: dayStart, lt: dayEnd } } },
        _count: { _all: true }
      });
      if (grouped.length === 0) return null;

      const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
      return [
        `Attendance summary for ${formatDate(latest.date)} (latest marked day):`,
        `- Total students marked: ${total}`,
        ...grouped.map((g) => `- ${g.status}: ${g._count._all}`)
      ].join("\n");
    }

    if (text.includes("fee") || text.includes("defaulter")) {
      const grouped = await prisma.studentFeeAssignment.groupBy({
        by: ["status"],
        where: { schoolId, status: { not: InstallmentStatus.PAID } },
        _count: { _all: true },
        _sum: { pendingAmount: true }
      });
      if (grouped.length === 0) return null;

      const totalCount = grouped.reduce((sum, g) => sum + g._count._all, 0);
      const totalPending = grouped.reduce(
        (sum, g) => sum + Number(g._sum.pendingAmount ?? 0),
        0
      );
      return [
        "Fee defaulters summary (unpaid fee assignments):",
        `- Total students with pending fees: ${totalCount}`,
        `- Total pending amount: ${totalPending}`,
        ...grouped.map(
          (g) => `- ${g.status}: ${g._count._all} students, pending ${Number(g._sum.pendingAmount ?? 0)}`
        )
      ].join("\n");
    }

    if (text.includes("student")) {
      const grouped = await prisma.student.groupBy({
        by: ["classId"],
        where: { schoolId, isActive: true },
        _count: { _all: true }
      });
      if (grouped.length === 0) return null;

      const classes = await prisma.class.findMany({
        where: { id: { in: grouped.map((g) => g.classId) } },
        select: { id: true, name: true, section: true },
        orderBy: [{ name: "asc" }, { section: "asc" }]
      });
      const countByClass = new Map(grouped.map((g) => [g.classId, g._count._all]));
      const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

      return [
        "Student enrollment summary (active students):",
        `- Total: ${total}`,
        ...classes.map((c) => `- Class ${c.name}-${c.section}: ${countByClass.get(c.id) ?? 0}`)
      ].join("\n");
    }

    return null;
  } catch {
    // Best-effort context only — never let a data lookup break the chat.
    return null;
  }
}

export const ask = asyncHandler(async (req: Request, res: Response) => {
  const { message, history } = askSchema.parse(req.body);
  const { id: userId, schoolId, role, schoolName } = req.user!;

  const erpContext = await buildErpContext(message, schoolId, role, req);

  await streamChat({
    message,
    history,
    userId,
    schoolId,
    role,
    schoolName: schoolName ?? "your school",
    erpContext,
    res
  });
});
