import { LeaveStatus, LeaveType, Prisma, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { env } from "../../config/env.js";
import { getDownloadUrl, uploadFile } from "../../services/storageService.js";

const approverRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);

const allowedAttachmentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

/** One row shape for both apps — the mobile Messages tab and the approval list. */
const leaveSelect = {
  id: true,
  type: true,
  status: true,
  fromDate: true,
  toDate: true,
  reason: true,
  attachmentName: true,
  attachmentKey: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  user: { select: { id: true, fullName: true, role: true, phone: true } },
  decidedBy: { select: { id: true, fullName: true } }
} satisfies Prisma.LeaveRequestSelect;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ select: typeof leaveSelect }>;

/** Inclusive day count — a single-day leave is 1 day, not 0. */
function dayCount(from: Date, to: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / millisecondsPerDay) + 1;
}

function toResponse(row: LeaveRow) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    fromDate: row.fromDate,
    toDate: row.toDate,
    days: dayCount(row.fromDate, row.toDate),
    reason: row.reason,
    attachmentName: row.attachmentName,
    hasAttachment: Boolean(row.attachmentKey),
    appliedOn: row.createdAt,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    applicant: {
      id: row.user.id,
      fullName: row.user.fullName,
      role: row.user.role,
      phone: row.user.phone
    },
    decidedBy: row.decidedBy ? { id: row.decidedBy.id, fullName: row.decidedBy.fullName } : null
  };
}

/** Midnight UTC, so a leave day is not shifted by the server timezone. */
function parseDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toSummary(grouped: { status: LeaveStatus; _count: { _all: number } }[]) {
  const counts = Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all]));
  const pending = counts[LeaveStatus.PENDING] ?? 0;
  const approved = counts[LeaveStatus.APPROVED] ?? 0;
  const rejected = counts[LeaveStatus.REJECTED] ?? 0;
  const cancelled = counts[LeaveStatus.CANCELLED] ?? 0;

  return { total: pending + approved + rejected + cancelled, pending, approved, rejected, cancelled };
}

export async function applyForLeave(
  user: Express.UserContext,
  payload: { type: LeaveType; fromDate: string; toDate: string; reason: string },
  file?: Express.Multer.File
) {
  const fromDate = parseDay(payload.fromDate);
  const toDate = parseDay(payload.toDate);

  let attachment: Pick<
    Prisma.LeaveRequestUncheckedCreateInput,
    "attachmentName" | "attachmentKey" | "attachmentMime" | "attachmentProvider"
  > = {};

  if (file) {
    if (!allowedAttachmentMimeTypes.has(file.mimetype)) {
      throw new AppError(
        400,
        "Attach a PDF or an image (JPEG, PNG or WebP).",
        "UNSUPPORTED_ATTACHMENT_TYPE",
        { mimeType: file.mimetype }
      );
    }

    const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
    const { storageKey, storageProvider } = await uploadFile({
      buffer: file.buffer,
      key: `${env.S3_KEY_PREFIX}/${user.schoolId}/leave/${randomUUID()}-${safeName}`,
      mimeType: file.mimetype,
      originalName: file.originalname
    });

    attachment = {
      attachmentName: file.originalname,
      attachmentKey: storageKey,
      attachmentMime: file.mimetype,
      attachmentProvider: storageProvider
    };
  }

  const created = await prisma.leaveRequest.create({
    data: {
      schoolId: user.schoolId,
      userId: user.id,
      type: payload.type,
      fromDate,
      toDate,
      reason: payload.reason,
      ...attachment
    },
    select: leaveSelect
  });

  return toResponse(created);
}

/** The signed-in user's own requests — what the teacher Messages tab shows. */
export async function listMyLeave(
  user: Express.UserContext,
  query: { status?: LeaveStatus; limit: number; offset: number }
) {
  const where: Prisma.LeaveRequestWhereInput = {
    schoolId: user.schoolId,
    userId: user.id,
    ...(query.status ? { status: query.status } : {})
  };

  // One round trip for the page, the total and every tile count.
  const [rows, total, grouped] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      select: leaveSelect,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId, userId: user.id },
      _count: { _all: true }
    })
  ]);

  return {
    items: rows.map(toResponse),
    total,
    hasMore: query.offset + rows.length < total,
    summary: toSummary(grouped)
  };
}

/** Every request in the school — the principal Leave Approval screen. */
export async function listSchoolLeave(
  user: Express.UserContext,
  query: { status?: LeaveStatus; search?: string; limit: number; offset: number }
) {
  const where: Prisma.LeaveRequestWhereInput = {
    schoolId: user.schoolId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { user: { fullName: { contains: query.search, mode: "insensitive" } } }
      : {})
  };

  const [rows, total, grouped] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      select: leaveSelect,
      // Oldest pending first: the principal works through a queue, not a feed.
      orderBy: query.status === LeaveStatus.PENDING ? { createdAt: "asc" } : { createdAt: "desc" },
      take: query.limit,
      skip: query.offset
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId },
      _count: { _all: true }
    })
  ]);

  return {
    items: rows.map(toResponse),
    total,
    hasMore: query.offset + rows.length < total,
    summary: toSummary(grouped)
  };
}

export async function decideLeave(
  user: Express.UserContext,
  id: string,
  payload: { status: "APPROVED" | "REJECTED"; note?: string }
) {
  if (!approverRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can decide leave requests.", "FORBIDDEN");
  }

  const request = await prisma.leaveRequest.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, userId: true, status: true }
  });
  if (!request) throw notFound("Leave request");

  // A principal applies for leave through the same endpoint as everyone else,
  // so self-approval has to be blocked here rather than by role alone.
  if (request.userId === user.id) {
    throw new AppError(403, "You cannot decide your own leave request.", "CANNOT_DECIDE_OWN_LEAVE");
  }

  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(
      409,
      `This request was already ${request.status.toLowerCase()}.`,
      "LEAVE_ALREADY_DECIDED"
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: request.id },
    data: {
      status: payload.status,
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNote: payload.note?.trim() || null
    },
    select: leaveSelect
  });

  return toResponse(updated);
}

/** The applicant may withdraw while it is still pending; nobody else can. */
export async function cancelLeave(user: Express.UserContext, id: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, userId: true, status: true }
  });
  if (!request) throw notFound("Leave request");

  if (request.userId !== user.id) {
    throw new AppError(403, "You can only withdraw your own leave request.", "FORBIDDEN");
  }
  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(
      409,
      `This request was already ${request.status.toLowerCase()}.`,
      "LEAVE_ALREADY_DECIDED"
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: request.id },
    data: { status: LeaveStatus.CANCELLED },
    select: leaveSelect
  });

  return toResponse(updated);
}

export async function downloadAttachment(user: Express.UserContext, id: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { userId: true, attachmentKey: true, attachmentName: true }
  });
  if (!request) throw notFound("Leave request");

  // Approvers see any attachment; everyone else only their own.
  if (!approverRoles.has(user.role as UserRole) && request.userId !== user.id) {
    throw new AppError(403, "You can only open your own leave attachment.", "FORBIDDEN");
  }
  if (!request.attachmentKey) throw notFound("Leave attachment");

  return {
    downloadUrl: await getDownloadUrl(request.attachmentKey),
    fileName: request.attachmentName ?? "leave-attachment"
  };
}
