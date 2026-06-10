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
      // If role is TEACHER we would also scope to the teacher's own classes,
      // but classId is not present on req.user yet, so we skip that filter.
      const records = await prisma.attendanceRecord.findMany({
        where: { schoolId },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          student: { select: { fullName: true } },
          session: { select: { date: true } }
        }
      });

      if (records.length === 0) return null;
      return records
        .map((r) => `- ${r.student.fullName}: ${r.status} on ${formatDate(r.session.date)}`)
        .join("\n");
    }

    if (text.includes("fee") || text.includes("defaulter")) {
      const assignments = await prisma.studentFeeAssignment.findMany({
        where: { schoolId, status: { not: InstallmentStatus.PAID } },
        take: 20,
        orderBy: { pendingAmount: "desc" },
        include: { student: { select: { fullName: true } } }
      });

      if (assignments.length === 0) return null;
      return assignments
        .map((a) => `- ${a.student.fullName}: ${a.status}, pending ${a.pendingAmount.toString()}`)
        .join("\n");
    }

    if (text.includes("student")) {
      const students = await prisma.student.findMany({
        where: { schoolId, isActive: true },
        take: 20,
        orderBy: [{ classId: "asc" }, { rollNumber: "asc" }],
        include: { class: { select: { name: true, section: true } } }
      });

      if (students.length === 0) return null;
      return students
        .map(
          (s) =>
            `- ${s.fullName} (Class ${s.class.name}-${s.class.section}, Roll ${s.rollNumber ?? "N/A"})`
        )
        .join("\n");
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
