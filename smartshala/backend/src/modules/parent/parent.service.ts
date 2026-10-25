import { AnnouncementAudience, HomeworkSubmissionStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { gradeForPercentage } from "../../core/grading.js";
import { parentStudentWhere } from "../../utils/parentPhone.js";
import { getDownloadUrl } from "../../services/storageService.js";
import { getStudentMonthlyAttendance } from "../attendance/attendance.service.js";
import { listMonth } from "../calendar/calendar.service.js";
import { getReceiptPdf, getStudentLedger } from "../fees/fees.service.js";
import { createStudentLeave, listStudentLeaveForStudent } from "../studentLeave/studentLeave.service.js";
import { signFeePayToken } from "./feePay.service.js";

/** Percentage from marks, rounded; 0 when there is no denominator. */
function pct(marks: unknown, max: unknown) {
  const m = Number(marks);
  const d = Number(max);
  if (!Number.isFinite(m) || !Number.isFinite(d) || d <= 0) return 0;
  return Math.round((m / d) * 100);
}

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
      parentName: true,
      class: { select: { name: true, section: true } }
    }
  });
  if (!student) throw notFound("Student");

  const month = monthKey(new Date());
  const monthly = await getStudentMonthlyAttendance(user, studentId, month);
  const todayStatus = monthly.daily.find((day) => day.date === dayKey(new Date()))?.status ?? null;

  return {
    parentName: student.parentName,
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

/**
 * One child's exam performance: each exam with its per-subject marks and grade,
 * plus an overall percentage. Grades reuse the school-wide bands.
 */
export async function childAcademics(user: Express.UserContext, studentId: string) {
  await assertOwnChild(user, studentId);

  const results = await prisma.examResult.findMany({
    where: { studentId },
    include: {
      exam: { select: { name: true, term: true, examDate: true } },
      subjectRef: { select: { name: true } }
    },
    orderBy: [{ examDate: "desc" }, { createdAt: "desc" }]
  });

  // Group results into the exam/test they belong to.
  const groups = new Map<string, {
    id: string;
    name: string;
    term: string | null;
    date: Date;
    subjects: { subject: string; marks: string; percentage: number; grade: string; isAbsent: boolean }[];
  }>();

  for (const r of results) {
    const date = r.exam?.examDate ?? r.examDate;
    const key = r.examId ?? `${r.assessmentName}|${date.toISOString().slice(0, 10)}`;
    const group = groups.get(key) ?? {
      id: key,
      name: r.exam?.name ?? r.assessmentName,
      term: r.exam?.term ?? null,
      date,
      subjects: []
    };
    const percentage = pct(r.marksObtained, r.maxMarks);
    group.subjects.push({
      subject: r.subjectRef?.name ?? r.subject ?? "—",
      marks: `${Number(r.marksObtained)}/${Number(r.maxMarks)}`,
      percentage,
      grade: r.grade ?? gradeForPercentage(percentage),
      isAbsent: r.isAbsent
    });
    groups.set(key, group);
  }

  const exams = Array.from(groups.values()).map((exam) => {
    const present = exam.subjects.filter((s) => !s.isAbsent);
    const average = present.length ? Math.round(present.reduce((a, s) => a + s.percentage, 0) / present.length) : 0;
    return {
      id: exam.id,
      name: exam.name,
      term: exam.term,
      date: exam.date,
      percentage: average,
      grade: gradeForPercentage(average),
      subjects: exam.subjects
    };
  });

  const overallPercentage = exams.length
    ? Math.round(exams.reduce((a, e) => a + e.percentage, 0) / exams.length)
    : 0;

  return {
    overall: { percentage: overallPercentage, grade: gradeForPercentage(overallPercentage) },
    exams
  };
}

/**
 * One child's homework: every assignment for their class with this child's
 * submission status. `completed` is true once the child has turned it in.
 */
export async function childHomework(user: Express.UserContext, studentId: string) {
  await assertOwnChild(user, studentId);

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) throw notFound("Student");

  const assignments = await prisma.homeworkAssignment.findMany({
    where: { classId: student.classId },
    include: {
      subjectRef: { select: { name: true } },
      submissions: { where: { studentId }, select: { status: true, marks: true, submittedAt: true } }
    },
    orderBy: [{ dueDate: "desc" }]
  });

  const items = assignments.map((a) => {
    const submission = a.submissions[0];
    const completed =
      submission != null &&
      (submission.status === HomeworkSubmissionStatus.ON_TIME || submission.status === HomeworkSubmissionStatus.LATE);
    return {
      id: a.id,
      title: a.title,
      subject: a.subjectRef?.name ?? a.subject ?? null,
      description: a.description,
      assignedDate: a.assignedDate,
      dueDate: a.dueDate,
      status: submission?.status ?? null,
      completed
    };
  });

  return { items };
}

/**
 * One child's fees: the overall summary, each fee assignment with what is still
 * due, and the payment history (with receipt ids for download). Reuses the same
 * ledger the web dashboard reads, so the numbers match.
 */
export async function childFees(user: Express.UserContext, studentId: string) {
  await assertOwnChild(user, studentId);
  const ledger = await getStudentLedger(user.schoolId, studentId);

  return {
    summary: {
      total: ledger.total,
      paid: ledger.paid,
      balance: ledger.balance,
      status: ledger.status
    },
    assignments: ledger.assignments.map((a) => ({
      id: a.id,
      name: a.feeStructure.name,
      total: a.total,
      paid: a.paid,
      pending: a.balance,
      currentlyDue: a.currentlyDue,
      status: a.status,
      payable: a.balance > 0
    })),
    payments: ledger.payments.map((p) => ({
      paymentId: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      mode: p.mode,
      receiptId: p.receiptId,
      receiptNo: p.receiptNo,
      feeStructureName: p.feeStructureName
    }))
  };
}

/**
 * Mint an external Razorpay pay link for one of the child's outstanding fee
 * assignments. The app opens it in a browser tab (no native payment surface —
 * Apple-safe). The amount is locked to the assignment's current balance.
 */
export async function createFeePayLink(user: Express.UserContext, studentId: string, assignmentId: string) {
  await assertOwnChild(user, studentId);

  const assignment = await prisma.studentFeeAssignment.findFirst({
    where: { id: assignmentId, schoolId: user.schoolId, studentId },
    select: { pendingAmount: true }
  });
  if (!assignment) throw notFound("Fee assignment");

  const amountMinor = Math.round(Number(assignment.pendingAmount) * 100);
  if (amountMinor <= 0) throw new AppError(409, "These fees are already paid", "FEE_ALREADY_PAID");

  const tenantSchoolId = user.tenantSchoolId;
  if (!tenantSchoolId) throw new AppError(409, "Payments are unavailable for this account", "FEE_PAY_UNAVAILABLE");

  const token = signFeePayToken({
    sid: user.schoolId,
    tsid: tenantSchoolId,
    stu: studentId,
    asg: assignmentId,
    amt: amountMinor,
    cur: env.BILLING_CURRENCY
  });

  return {
    payUrl: `${env.FRONTEND_URL.replace(/\/$/, "")}/student-pay/${token}`,
    amountMinor,
    currency: env.BILLING_CURRENCY
  };
}

/** The PDF receipt for one of the child's payments. Ownership-guarded. */
export async function childFeeReceiptPdf(user: Express.UserContext, studentId: string, paymentId: string) {
  await assertOwnChild(user, studentId);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId: user.schoolId, studentId },
    select: { receipt: { select: { id: true } } }
  });
  if (!payment?.receipt) throw notFound("Receipt");

  return getReceiptPdf(user.schoolId, payment.receipt.id);
}

/**
 * The school calendar for one month — exactly what the staff apps read, scoped
 * to the parent's school. The same events and holidays apply to every child, so
 * this is school-wide rather than per-child.
 */
export async function schoolCalendar(user: Express.UserContext, month?: string) {
  return listMonth(user, month ?? monthKey(new Date()));
}

/**
 * The announcements a parent may read: the school's `PARENTS`-audience notices
 * and anything addressed to everyone, newest first. Parents have no `User` row,
 * so there is no per-notice read state to track — the feed is purely read-only.
 */
export async function parentAnnouncements(
  user: Express.UserContext,
  query: { limit: number; offset: number }
) {
  const where = {
    schoolId: user.schoolId,
    audience: { in: [AnnouncementAudience.ALL, AnnouncementAudience.PARENTS] }
  };

  const [rows, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: { postedBy: { select: { id: true, fullName: true, role: true } } }
    }),
    prisma.announcement.count({ where })
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      priority: row.priority,
      publishedAt: row.publishedAt,
      // No read tracking for parents — present every notice as read so the feed
      // never shows a permanent "unread" badge it can never clear.
      isRead: true,
      postedBy: row.postedBy
        ? { id: row.postedBy.id, fullName: row.postedBy.fullName, role: row.postedBy.role }
        : null
    })),
    total,
    unreadCount: 0,
    hasMore: query.offset + rows.length < total
  };
}

/** One child's documents — report cards, certificates and the like. Ownership-guarded. */
export async function childDocuments(user: Express.UserContext, studentId: string) {
  await assertOwnChild(user, studentId);

  const documents = await prisma.studentDocument.findMany({
    where: { schoolId: user.schoolId, studentId },
    orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      name: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true
    }
  });

  return { documents };
}

/**
 * A download for one of the child's documents. Mirrors the staff download: on
 * S3 it is a short-lived presigned URL (the app opens it in a browser tab —
 * Apple-safe); on local disk it is the storage key for the controller to serve.
 */
export async function childDocumentDownload(user: Express.UserContext, studentId: string, documentId: string) {
  await assertOwnChild(user, studentId);

  const document = await prisma.studentDocument.findFirst({
    where: { id: documentId, studentId, schoolId: user.schoolId },
    select: { originalName: true, storageKey: true }
  });
  if (!document) throw notFound("Document");
  if (!document.storageKey) throw notFound("Document file");

  const downloadUrl = await getDownloadUrl(document.storageKey);
  return { downloadUrl, fileName: document.originalName };
}

/** The leave requests this parent has raised for one of their children. */
export async function childLeaveRequests(user: Express.UserContext, studentId: string) {
  await assertOwnChild(user, studentId);
  return { requests: await listStudentLeaveForStudent(user.schoolId, studentId) };
}

/** A parent raising a new leave/absence request for their child. */
export async function submitChildLeave(
  user: Express.UserContext,
  studentId: string,
  input: { fromDate: string; toDate: string; reason: string }
) {
  await assertOwnChild(user, studentId);
  return createStudentLeave({
    schoolId: user.schoolId,
    studentId,
    requestedByPhone: user.phone ?? "",
    requestedByName: user.fullName ?? null,
    // Local midnight, the same day boundary attendance uses.
    fromDate: new Date(`${input.fromDate}T00:00:00`),
    toDate: new Date(`${input.toDate}T00:00:00`),
    reason: input.reason
  });
}
