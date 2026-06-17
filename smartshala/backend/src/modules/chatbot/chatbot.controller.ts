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
      // Always report TODAY's attendance. If it has not been marked yet, say so
      // explicitly rather than falling back to an older (or future-dated) marked
      // day — that would misrepresent stale data as today's attendance.
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const grouped = await prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { schoolId, session: { date: { gte: dayStart, lt: dayEnd } } },
        _count: { _all: true }
      });
      if (grouped.length === 0) {
        return `Today's attendance (${formatDate(dayStart)}) has not been taken yet.`;
      }

      const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
      return [
        `Attendance summary for today (${formatDate(dayStart)}):`,
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

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Appends messages to the ONE activity log for a chat conversation. The first
 * message of a new conversation creates the log; every later message in the
 * same conversation is appended to the same log's transcript, so the whole
 * chat (all questions and answers) shows up as a single entry. A new chat (new
 * conversationId) produces a new log. Best-effort: never break the chat.
 */
async function appendConversationMessages(
  conversationId: string,
  user: Express.UserContext,
  newMessages: ChatTurn[]
) {
  if (newMessages.length === 0) return;

  // Cap each message so a long reply can't bloat the audit row.
  const trimmed = newMessages.map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  try {
    const existing = await prisma.auditLog.findFirst({
      where: { schoolId: user.schoolId, entityType: "CHATBOT", entityId: conversationId },
      select: { id: true, afterJson: true }
    });

    if (existing) {
      const prev =
        existing.afterJson && typeof existing.afterJson === "object" && !Array.isArray(existing.afterJson)
          ? (existing.afterJson as Record<string, unknown>)
          : {};
      const prevMessages = Array.isArray(prev.messages) ? (prev.messages as ChatTurn[]) : [];
      const messages = [...prevMessages, ...trimmed].slice(-100);
      await prisma.auditLog.update({
        where: { id: existing.id },
        data: { afterJson: { messages, messageCount: messages.length } }
      });
      return;
    }

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorId: user.id,
        entityType: "CHATBOT",
        entityId: conversationId,
        action: "CHAT",
        summary: `${user.fullName} used the AI assistant`,
        afterJson: { messages: trimmed, messageCount: trimmed.length }
      }
    });
  } catch (err) {
    console.error("[chatbot.controller] appendConversationMessages error (ignored):", err);
  }
}

export const ask = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId, message, history } = askSchema.parse(req.body);
  const { id: userId, schoolId, role, schoolName } = req.user!;

  // Log the user's question first so it is recorded even if the AI call fails.
  if (conversationId) await appendConversationMessages(conversationId, req.user!, [{ role: "user", content: message }]);

  const erpContext = await buildErpContext(message, schoolId, role, req);

  const assistantText = await streamChat({
    message,
    history,
    userId,
    schoolId,
    role,
    schoolName: schoolName ?? "your school",
    erpContext,
    res
  });

  // Append the assistant's reply to the same conversation log.
  if (conversationId && assistantText) {
    await appendConversationMessages(conversationId, req.user!, [{ role: "assistant", content: assistantText }]);
  }
});
