import { prisma } from "../../core/prisma.js";
import { notFound } from "../../core/errors.js";
import { parentStudentWhere } from "../../utils/parentPhone.js";
import { getStudentMonthlyAttendance } from "../attendance/attendance.service.js";

/** YYYY-MM for the given date, local time. */
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD for the given date, local time — the same format attendance uses. */
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The parent may only see their own active children; anything else is a 404. */
async function assertOwnChild(user: Express.UserContext, studentId: string) {
  const child = await prisma.student.findFirst({
    where: { id: studentId, isActive: true, ...parentStudentWhere(user.phone ?? "") },
    select: { id: true }
  });
  if (!child) throw notFound("Student");
}

/**
 * The children a signed-in parent may see: every active student in the tenant
 * reachable through the parent's login mobile. The token's phone is the single
 * source of who this parent is.
 */
export async function listChildren(user: Express.UserContext) {
  const phone = user.phone ?? "";
  if (!phone) return { children: [] };

  const students = await prisma.student.findMany({
    where: { ...parentStudentWhere(phone), isActive: true },
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      admissionNumber: true,
      profilePhotoUrl: true,
      class: { select: { name: true, section: true } }
    },
    orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }]
  });

  return {
    children: students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      className: student.class ? `${student.class.name} - ${student.class.section}` : null,
      profilePhotoUrl: student.profilePhotoUrl
    }))
  };
}

/** One child's monthly attendance — percentage, counts, and per-day marks for the calendar. */
export async function childAttendance(user: Express.UserContext, studentId: string, month?: string) {
  await assertOwnChild(user, studentId);
  return getStudentMonthlyAttendance(user, studentId, month ?? monthKey(new Date()));
}

/**
 * The Home screen aggregate for one child. Phase 2 is attendance-centric; fees,
 * events and announcements join it in their own phases.
 */
export async function childHome(user: Express.UserContext, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true, ...parentStudentWhere(user.phone ?? "") },
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      admissionNumber: true,
      profilePhotoUrl: true,
      class: { select: { name: true, section: true } }
    }
  });
  if (!student) throw notFound("Student");

  const month = monthKey(new Date());
  const monthly = await getStudentMonthlyAttendance(user, studentId, month);
  const todayStatus = monthly.daily.find((day) => day.date === dayKey(new Date()))?.status ?? null;

  return {
    child: {
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      className: student.class ? `${student.class.name} - ${student.class.section}` : null,
      profilePhotoUrl: student.profilePhotoUrl
    },
    attendance: {
      month,
      percentage: monthly.summary.percentage,
      present: monthly.summary.present,
      absent: monthly.summary.absent,
      leave: monthly.summary.leave,
      totalDays: monthly.summary.totalDays,
      todayStatus
    }
  };
}
