import { LeaveStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { normalizePhone } from "../../utils/parentPhone.js";
import { notifyStudentLeaveDecided, notifyStudentLeaveSubmitted } from "../push/push.events.js";

/**
 * Child-leave requests a parent raises from the Parent app. The parent-facing
 * create/list helpers here are called by the parent module after its own
 * ownership check; the staff-facing list/decide are reached through
 * `/student-leave`. The row shape is shared so both sides read the same fields.
 */

const schoolWideApprovers = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);

/**
 * A teacher only ever sees and decides leave for a class they are the class
 * teacher of; everyone else works the whole school. Returned as a `where`
 * fragment so the list, its counts and the decision all scope the same way.
 */
function classTeacherScope(user: Express.UserContext): Prisma.StudentLeaveRequestWhereInput {
  return user.role === UserRole.TEACHER
    ? { student: { class: { classTeacherId: user.id } } }
    : {};
}

const leaveSelect = {
  id: true,
  fromDate: true,
  toDate: true,
  reason: true,
  status: true,
  requestedByName: true,
  requestedByPhone: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  student: {
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      admissionNumber: true,
      class: { select: { name: true, section: true } }
    }
  },
  decidedBy: { select: { id: true, fullName: true } }
} satisfies Prisma.StudentLeaveRequestSelect;

type LeaveRow = Prisma.StudentLeaveRequestGetPayload<{ select: typeof leaveSelect }>;

/** Inclusive day count — a single-day leave is 1 day, not 0. */
function dayCount(from: Date, to: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / millisecondsPerDay) + 1;
}

export function toStudentLeaveResponse(row: LeaveRow) {
  return {
    id: row.id,
    fromDate: row.fromDate,
    toDate: row.toDate,
    days: dayCount(row.fromDate, row.toDate),
    reason: row.reason,
    status: row.status,
    appliedOn: row.createdAt,
    requestedByName: row.requestedByName,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    decidedBy: row.decidedBy ? { id: row.decidedBy.id, fullName: row.decidedBy.fullName } : null,
    student: {
      id: row.student.id,
      fullName: row.student.fullName,
      rollNumber: row.student.rollNumber,
      admissionNumber: row.student.admissionNumber,
      className: row.student.class ? `${row.student.class.name} - ${row.student.class.section}` : null
    }
  };
}

export type StudentLeaveResponse = ReturnType<typeof toStudentLeaveResponse>;

// --- Parent-facing (called from the parent module, already ownership-checked) ---

export async function createStudentLeave(input: {
  schoolId: string;
  studentId: string;
  requestedByPhone: string;
  requestedByName: string | null;
  fromDate: Date;
  toDate: Date;
  reason: string;
}): Promise<StudentLeaveResponse> {
  if (input.toDate.getTime() < input.fromDate.getTime()) {
    throw new AppError(400, "The end date cannot be before the start date.", "INVALID_LEAVE_RANGE");
  }

  const created = await prisma.studentLeaveRequest.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      requestedByPhone: normalizePhone(input.requestedByPhone),
      requestedByName: input.requestedByName,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason.trim()
    },
    select: leaveSelect
  });

  // The class teacher is the one who acts on it, so they are told directly
  // rather than finding it in a queue they share with the office.
  const studentClass = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { class: { select: { classTeacherId: true } } }
  });

  notifyStudentLeaveSubmitted(
    { schoolId: input.schoolId },
    {
      studentName: created.student.fullName,
      fromDate: created.fromDate,
      toDate: created.toDate,
      days: dayCount(created.fromDate, created.toDate),
      classTeacherId: studentClass?.class?.classTeacherId ?? null
    }
  );

  return toStudentLeaveResponse(created);
}

export async function listStudentLeaveForStudent(schoolId: string, studentId: string) {
  const rows = await prisma.studentLeaveRequest.findMany({
    where: { schoolId, studentId },
    select: leaveSelect,
    orderBy: { createdAt: "desc" }
  });
  return rows.map(toStudentLeaveResponse);
}

// --- Staff-facing (`/student-leave`) ---

export async function listStudentLeave(
  user: Express.UserContext,
  query: { status?: LeaveStatus; limit: number; offset: number }
) {
  const scope = classTeacherScope(user);
  const where: Prisma.StudentLeaveRequestWhereInput = {
    schoolId: user.schoolId,
    ...scope,
    ...(query.status ? { status: query.status } : {})
  };

  const [rows, total, grouped] = await Promise.all([
    prisma.studentLeaveRequest.findMany({
      where,
      select: leaveSelect,
      // Oldest pending first so the queue is worked in order; decided history newest first.
      orderBy: query.status === LeaveStatus.PENDING ? { createdAt: "asc" } : { createdAt: "desc" },
      take: query.limit,
      skip: query.offset
    }),
    prisma.studentLeaveRequest.count({ where }),
    prisma.studentLeaveRequest.groupBy({
      by: ["status"],
      where: { schoolId: user.schoolId, ...scope },
      _count: { _all: true }
    })
  ]);

  const summary = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 } as Record<LeaveStatus, number>;
  for (const group of grouped) summary[group.status] = group._count._all;

  return {
    items: rows.map(toStudentLeaveResponse),
    total,
    hasMore: query.offset + rows.length < total,
    summary
  };
}

export async function decideStudentLeave(
  user: Express.UserContext,
  id: string,
  payload: { status: "APPROVED" | "REJECTED"; note?: string }
) {
  const isSchoolWide = schoolWideApprovers.has(user.role as UserRole);
  if (!isSchoolWide && user.role !== UserRole.TEACHER) {
    throw new AppError(403, "You cannot decide leave requests.", "FORBIDDEN");
  }

  // Scoping the lookup rather than checking after it means a teacher cannot
  // even learn that another class's request exists.
  const request = await prisma.studentLeaveRequest.findFirst({
    where: { id, schoolId: user.schoolId, ...classTeacherScope(user) },
    select: { id: true, status: true, requestedByPhone: true }
  });
  if (!request) throw notFound("Leave request");

  if (request.status !== LeaveStatus.PENDING) {
    throw new AppError(409, `This request was already ${request.status.toLowerCase()}.`, "LEAVE_ALREADY_DECIDED");
  }

  const updated = await prisma.studentLeaveRequest.update({
    where: { id: request.id },
    data: {
      status: payload.status,
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNote: payload.note?.trim() || null
    },
    select: leaveSelect
  });

  notifyStudentLeaveDecided(user.schoolId, request.requestedByPhone, {
    studentName: updated.student.fullName,
    approved: payload.status === "APPROVED",
    fromDate: updated.fromDate,
    toDate: updated.toDate,
    note: updated.decisionNote
  });

  return toStudentLeaveResponse(updated);
}
