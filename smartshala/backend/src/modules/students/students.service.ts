import { randomUUID } from "node:crypto";
import {
  AttendanceStatus,
  BehaviourSeverity,
  BehaviourType,
  HomeworkSubmissionStatus,
  NotificationKind,
  InstallmentStatus,
  StudentDocumentType,
  UserRole,
  Prisma
} from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { logger } from "../../config/logger.js";
import { getPagination } from "../../core/pagination.js";
import { AppError, notFound } from "../../core/errors.js";
import { gradeForPercentage } from "../../core/grading.js";
import { calculateStudentAttendanceSummary } from "../../core/studentAttendance.js";
import { recordAuditLog } from "../../core/auditLog.js";
import { assignFee } from "../fees/fees.service.js";
import { env } from "../../config/env.js";
import { uploadFile, getDownloadUrl, deleteFile } from "../../services/storageService.js";

type AttendanceForSnapshot = {
  status: AttendanceStatus;
  attendanceValue?: unknown;
  session: { date: Date };
};

type ExamForPerformance = {
  marksObtained: unknown;
  maxMarks: unknown;
};

type HomeworkForPerformance = {
  completionPercentage: unknown;
};

type StudentProfileTab = "academic" | "homework" | "attendance" | "fees" | "communication" | "behaviour" | "documents";

const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const fullAccessTabs: StudentProfileTab[] = ["academic", "homework", "attendance", "fees", "communication", "behaviour", "documents"];
const teacherTabs: StudentProfileTab[] = ["academic", "homework", "attendance", "communication", "behaviour"];
const accountantTabs: StudentProfileTab[] = ["fees"];
const parentTabs: StudentProfileTab[] = ["academic", "homework", "attendance", "fees"];
const queryCache = new Map<string, { expiresAt: number; value: unknown }>();

function isPrincipalRole(role: UserRole) {
  return role === UserRole.PRINCIPAL || role === UserRole.ADMIN;
}

function allowedTabsForRole(role: UserRole): StudentProfileTab[] {
  if (isPrincipalRole(role)) return fullAccessTabs;
  if (role === UserRole.TEACHER) return teacherTabs;
  if (role === UserRole.ACCOUNTANT) return accountantTabs;
  if (role === UserRole.PARENT) return parentTabs;
  return [];
}

function hasTab(tabs: StudentProfileTab[], tab: StudentProfileTab) {
  return tabs.includes(tab);
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const current = queryCache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value as T;
  const value = await loader();
  queryCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

async function phoneForUser(user: Express.UserContext) {
  if (user.phone) return user.phone;
  const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } });
  return currentUser?.phone ?? "";
}

async function studentAccessFilter(user: Express.UserContext) {
  if (user.role === UserRole.TEACHER) {
    return {
      class: {
        OR: [
          { classTeacherId: user.id },
          { teacherPeriodAssignments: { some: { teacherId: user.id } } }
        ]
      }
    };
  }
  if (user.role === UserRole.PARENT) {
    const phone = await phoneForUser(user);
    if (!phone) return { parentPhone: "__NO_PARENT_PHONE__" };
    return { OR: [{ parentPhone: phone }, { alternatePhone: phone }] };
  }
  return {};
}

function emptyHomeworkAnalytics() {
  return {
    completionPercentage: null,
    counts: { total: 0, onTime: 0, late: 0, missing: 0, pending: 0 },
    currentStreak: 0,
    classAverageStreak: 0,
    subjects: [],
    assignments: []
  };
}

function emptyAttendanceAnalytics() {
  return {
    records: [],
    calendar: [],
    metrics: { attendancePercentage: 0, totalDays: 0, absences: 0, late: 0, halfDays: 0, attended: 0, remainingBefore75: 0, classAverageAttendance: null },
    cbseWarning: false,
    repeatedWeekdayAbsences: []
  };
}

function emptyBehaviourAnalytics(role: UserRole) {
  return {
    canViewCounsellorNotes: canViewCounsellorNotes(role),
    counts: { incidents: 0, achievements: 0, counsellorNotes: 0, total: 0 },
    records: []
  };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function feeStatus(pendingAmount: number, paidAmount: number) {
  if (pendingAmount === 0) return InstallmentStatus.PAID;
  return paidAmount > 0 ? InstallmentStatus.PARTIAL : InstallmentStatus.PENDING;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "document";
}

function documentResponse(document: {
  id: string;
  type: StudentDocumentType;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: { id: string; fullName: string; role: UserRole };
}) {
  return {
    id: document.id,
    type: document.type,
    name: document.name,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.uploadedAt,
    uploadedBy: document.uploadedBy
  };
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageNumber(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function attendanceSnapshot(records: AttendanceForSnapshot[]) {
  const summary = calculateStudentAttendanceSummary(records);

  return {
    attendancePercentage: summary.attendancePercentage,
    lastAbsentDate: summary.lastAbsentDate
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function attendanceAnalytics(records: AttendanceForSnapshot[], classAverageAttendance: number | null = null) {
  const sortedRecords = [...records].sort((a, b) => a.session.date.getTime() - b.session.date.getTime());
  const attendanceRows = sortedRecords.map((record) => ({
    date: record.session.date,
    status: record.status
  }));

  const summary = calculateStudentAttendanceSummary(sortedRecords);

  const now = new Date();
  const recordByDate = new Map(attendanceRows.map((record) => [isoDate(record.date), record.status]));
  const calendar: { date: Date; status: AttendanceStatus | "HOLIDAY" | "UNMARKED" }[] = [];

  // Build a full-month grid for every month the records span, plus the current
  // month, so the month filter on the student page has real months to switch between.
  const monthKeys = new Set<string>(attendanceRows.map((record) => `${record.date.getFullYear()}-${record.date.getMonth()}`));
  monthKeys.add(`${now.getFullYear()}-${now.getMonth()}`);
  const months = [...monthKeys]
    .map((key) => key.split("-").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  for (const [year, month] of months) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month, day);
      const key = isoDate(date);
      const status = date.getDay() === 0 ? "HOLIDAY" : recordByDate.get(key) ?? "UNMARKED";
      calendar.push({ date, status });
    }
  }

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayAbsences = new Map<number, Date[]>();
  attendanceRows
    .filter((record) => record.status === AttendanceStatus.ABSENT)
    .forEach((record) => {
      const day = record.date.getDay();
      const dates = weekdayAbsences.get(day) ?? [];
      dates.push(record.date);
      weekdayAbsences.set(day, dates);
    });

  const repeatedWeekdayAbsences = Array.from(weekdayAbsences.entries())
    .filter(([, dates]) => dates.length >= 2)
    .map(([weekday, dates]) => ({
      weekday: weekdays[weekday],
      count: dates.length,
      dates: dates.map((date) => startOfLocalDay(date))
    }))
    .sort((a, b) => b.count - a.count || a.weekday.localeCompare(b.weekday));

  return {
    records: attendanceRows,
    calendar,
      metrics: {
      attendancePercentage: summary.attendancePercentage,
      totalDays: summary.totalDays,
      absences: summary.absences,
      late: summary.late,
      halfDays: summary.halfDays,
      attended: summary.attended,
      remainingBefore75: summary.remainingBefore75,
      classAverageAttendance
    },
    cbseWarning: summary.attendancePercentage > 0 && summary.attendancePercentage < 80,
    repeatedWeekdayAbsences
  };
}

async function classAverageAttendance(schoolId: string, classId: string) {
  const classmates = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: {
      attendanceRecords: {
        take: 60,
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          attendanceValue: true,
          session: { select: { date: true } }
        }
      }
    }
  });

  const percentages = classmates
    .map((classmate) => calculateStudentAttendanceSummary(classmate.attendanceRecords).attendancePercentage)
    .filter((percentage) => percentage > 0);

  return average(percentages);
}

function percentage(marksObtained: unknown, maxMarks: unknown) {
  const max = toNumber(maxMarks);
  if (max <= 0) return 0;
  return Math.round(clampPercentage((toNumber(marksObtained) / max) * 100));
}

function classifyPerformance(performanceRate: number | null) {
  if (performanceRate === null) return null;
  if (performanceRate >= 85) return "Excellent";
  if (performanceRate >= 70) return "Good";
  if (performanceRate >= 50) return "Needs Attention";
  return "At Risk";
}

type AcademicExamResult = {
  id: string;
  studentId: string;
  marksObtained: unknown;
  maxMarks: unknown;
  assessmentName: string;
  subject: string | null;
  examDate: Date;
  examId: string | null;
  subjectId: string | null;
  exam: { id: string; name: string; examDate: Date } | null;
  subjectRef: { id: string; name: string } | null;
};

type AcademicHomeworkRecord = {
  studentId: string;
  subject: string | null;
  subjectId: string | null;
  completionPercentage: unknown;
  subjectRef: { id: string; name: string } | null;
};

type HomeworkAssignmentForAnalytics = {
  id: string;
  title: string;
  subject: string | null;
  assignedDate: Date;
  dueDate: Date;
  maxMarks: unknown;
  subjectRef: { id: string; name: string } | null;
  submissions: {
    studentId: string;
    status: HomeworkSubmissionStatus;
    marks: unknown;
    teacherNote: string | null;
    submittedAt: Date | null;
  }[];
};

function examName(result: AcademicExamResult) {
  return result.exam?.name ?? result.assessmentName;
}

function subjectName(result: Pick<AcademicExamResult, "subject" | "subjectRef">) {
  return result.subjectRef?.name ?? result.subject ?? "General";
}

function homeworkSubjectName(record: AcademicHomeworkRecord) {
  return record.subjectRef?.name ?? record.subject ?? "General";
}

function examSubjectKey(result: AcademicExamResult) {
  return result.examId && result.subjectId
    ? `${result.examId}:${result.subjectId}`
    : `${examName(result).toLowerCase()}:${subjectName(result).toLowerCase()}`;
}

function examKey(result: AcademicExamResult) {
  return result.examId ?? examName(result).toLowerCase();
}

function subjectKeyFromResult(result: AcademicExamResult) {
  return result.subjectId ?? subjectName(result).toLowerCase();
}

function subjectKeyFromHomework(record: AcademicHomeworkRecord) {
  return record.subjectId ?? homeworkSubjectName(record).toLowerCase();
}

function homeworkAssignmentSubjectName(assignment: HomeworkAssignmentForAnalytics) {
  return assignment.subjectRef?.name ?? assignment.subject ?? "General";
}

function homeworkSubmissionForStudent(assignment: HomeworkAssignmentForAnalytics, studentId: string) {
  return assignment.submissions.find((submission) => submission.studentId === studentId);
}

function normalizeHomeworkStatus(assignment: HomeworkAssignmentForAnalytics, studentId: string) {
  const submission = homeworkSubmissionForStudent(assignment, studentId);
  if (submission) return submission.status;
  return assignment.dueDate.getTime() < Date.now() ? HomeworkSubmissionStatus.NOT_SUBMITTED : null;
}

function isHomeworkNotSubmitted(status: HomeworkSubmissionStatus | "PENDING" | string) {
  return status === HomeworkSubmissionStatus.MISSING || status === HomeworkSubmissionStatus.NOT_SUBMITTED;
}

function homeworkStreakForStudent(assignments: HomeworkAssignmentForAnalytics[], studentId: string) {
  return [...assignments]
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
    .reduce((streak, assignment) => {
      if (streak.stopped) return streak;
      const status = normalizeHomeworkStatus(assignment, studentId);
      if (status === HomeworkSubmissionStatus.ON_TIME) return { count: streak.count + 1, stopped: false };
      if (status === null) return streak;
      return { ...streak, stopped: true };
    }, { count: 0, stopped: false }).count;
}

function homeworkAnalyticsFromAssignments(assignments: HomeworkAssignmentForAnalytics[], studentId: string, classmateIds: string[]) {
  const total = assignments.length;
  const log = assignments
    .map((assignment) => {
      const submission = homeworkSubmissionForStudent(assignment, studentId);
      const status = normalizeHomeworkStatus(assignment, studentId);

      return {
        id: assignment.id,
        title: assignment.title,
        subject: homeworkAssignmentSubjectName(assignment),
        assignedDate: assignment.assignedDate,
        dueDate: assignment.dueDate,
        status: status ?? "PENDING",
        marks: submission?.marks === null || submission?.marks === undefined ? null : toNumber(submission.marks),
        maxMarks: assignment.maxMarks === null || assignment.maxMarks === undefined ? null : toNumber(assignment.maxMarks),
        teacherNote: submission?.teacherNote ?? null,
        submittedAt: submission?.submittedAt ?? null
      };
    })
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  const onTime = log.filter((item) => item.status === HomeworkSubmissionStatus.ON_TIME).length;
  const late = log.filter((item) => item.status === HomeworkSubmissionStatus.LATE).length;
  const missing = log.filter((item) => isHomeworkNotSubmitted(item.status)).length;
  const pending = log.filter((item) => item.status === "PENDING").length;
  const completionPercentage = total ? Math.round((onTime / total) * 100) : null;
  const currentStreak = homeworkStreakForStudent(assignments, studentId);
  const classAverageStreak = classmateIds.length
    ? Math.round(averageNumber(classmateIds.map((classmateId) => homeworkStreakForStudent(assignments, classmateId))))
    : 0;

  const subjectMap = new Map<string, { subject: string; total: number; onTime: number; late: number; missing: number }>();
  log.forEach((item) => {
    const current = subjectMap.get(item.subject) ?? { subject: item.subject, total: 0, onTime: 0, late: 0, missing: 0 };
    current.total += 1;
    if (item.status === HomeworkSubmissionStatus.ON_TIME) current.onTime += 1;
    if (item.status === HomeworkSubmissionStatus.LATE) current.late += 1;
    if (isHomeworkNotSubmitted(item.status)) current.missing += 1;
    subjectMap.set(item.subject, current);
  });

  const subjects = Array.from(subjectMap.values())
    .map((subject) => ({
      ...subject,
      completionPercentage: subject.total ? Math.round((subject.onTime / subject.total) * 100) : 0
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    completionPercentage,
    counts: { total, onTime, late, missing, pending },
    currentStreak,
    classAverageStreak,
    subjects,
    assignments: log
  };
}

async function homeworkAnalytics(schoolId: string, classId: string, studentId: string) {
  const classmates = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { id: true }
  });
  const classmateIds = classmates.map((student) => student.id);
  const assignments = await prisma.homeworkAssignment.findMany({
    where: { schoolId, classId },
    include: {
      subjectRef: { select: { id: true, name: true } },
      submissions: {
        where: { studentId: { in: classmateIds } },
        select: { studentId: true, status: true, marks: true, teacherNote: true, submittedAt: true }
      }
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }]
  });

  return homeworkAnalyticsFromAssignments(assignments as HomeworkAssignmentForAnalytics[], studentId, classmateIds);
}

async function homeworkCompletionOverridesForStudents(
  schoolId: string,
  students: { id: string; classId: string }[]
) {
  const result = new Map<string, number | null>();
  if (students.length === 0) return result;

  const studentIds = students.map((student) => student.id);
  const classIds = Array.from(new Set(students.map((student) => student.classId)));
  const assignments = await prisma.homeworkAssignment.findMany({
    where: { schoolId, classId: { in: classIds } },
    select: {
      classId: true,
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true, status: true }
      }
    }
  });

  const totalsByClass = new Map<string, number>();
  const onTimeByStudent = new Map<string, number>();

  assignments.forEach((assignment) => {
    totalsByClass.set(assignment.classId, (totalsByClass.get(assignment.classId) ?? 0) + 1);
    assignment.submissions.forEach((submission) => {
      if (submission.status === HomeworkSubmissionStatus.ON_TIME) {
        onTimeByStudent.set(submission.studentId, (onTimeByStudent.get(submission.studentId) ?? 0) + 1);
      }
    });
  });

  students.forEach((student) => {
    const total = totalsByClass.get(student.classId) ?? 0;
    result.set(student.id, total ? Math.round(((onTimeByStudent.get(student.id) ?? 0) / total) * 100) : null);
  });

  return result;
}

async function communicationAudit(user: Express.UserContext, studentId: string) {
  const notificationWhere = {
    schoolId: user.schoolId,
    studentId,
    ...(user.role === UserRole.TEACHER
      ? {
          kind: {
            notIn: [NotificationKind.FEE_REMINDER, NotificationKind.OVERDUE_FEE, NotificationKind.PAYMENT_RECEIPT]
          }
        }
      : {})
  };
  const [notifications, communicationLogs] = await Promise.all([
    prisma.notification.findMany({
      where: notificationWhere,
      select: {
        id: true,
        kind: true,
        recipientPhone: true,
        message: true,
        status: true,
        sentAt: true,
        createdAt: true
      }
    }),
    prisma.communicationLog.findMany({
      where: { schoolId: user.schoolId, studentId },
      select: {
        id: true,
        type: true,
        messageType: true,
        channel: true,
        summary: true,
        status: true,
        timestamp: true
      }
    })
  ]);

  return [
    ...notifications.map((notification) => ({
      id: notification.id,
      type: "WHATSAPP",
      channel: "WHATSAPP",
      summary: notification.message,
      status: notification.status,
      timestamp: notification.sentAt ?? notification.createdAt,
      source: "notification",
      reference: notification.kind,
      recipientPhone: notification.recipientPhone
    })),
    ...communicationLogs.map((log) => ({
      id: log.id,
      type: log.type,
      channel: log.channel,
      summary: log.summary,
      status: log.status,
      timestamp: log.timestamp,
      source: "communication_log",
      reference: log.messageType,
      recipientPhone: null
    }))
  ].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime() || right.id.localeCompare(left.id));
}

function canViewCounsellorNotes(role: UserRole) {
  return isPrincipalRole(role);
}

async function behaviourAnalytics(user: Express.UserContext, studentId: string) {
  const showCounsellorNotes = canViewCounsellorNotes(user.role);
  const records = await prisma.behaviourRecord.findMany({
    where: {
      schoolId: user.schoolId,
      studentId,
      ...(showCounsellorNotes ? {} : { type: { not: BehaviourType.COUNSELLOR_NOTE } })
    },
    include: {
      createdBy: { select: { id: true, fullName: true, role: true } }
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });

  const incidents = records.filter((record) => record.type === BehaviourType.INCIDENT).length;
  const achievements = records.filter((record) => record.type === BehaviourType.ACHIEVEMENT).length;
  const counsellorNotes = records.filter((record) => record.type === BehaviourType.COUNSELLOR_NOTE).length;

  return {
    canViewCounsellorNotes: showCounsellorNotes,
    counts: {
      incidents,
      achievements,
      counsellorNotes,
      total: records.length
    },
    records: records.map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      summary: record.summary,
      severity: record.severity,
      occurredAt: record.occurredAt,
      isRestricted: record.isRestricted,
      actionTaken: record.actionTaken,
      createdBy: record.createdBy
        ? {
            id: record.createdBy.id,
            fullName: record.createdBy.fullName,
            role: record.createdBy.role
          }
        : null
    }))
  };
}

async function documentAudit(schoolId: string, studentId: string) {
  const documents = await prisma.studentDocument.findMany({
    where: { schoolId, studentId },
    include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
    orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }]
  });

  return documents.map(documentResponse);
}

async function academicAnalytics(schoolId: string, classId: string, studentId: string) {
  const classmates = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { id: true }
  });
  const classmateIds = classmates.map((student) => student.id);

  const [results, homeworkRecords] = await Promise.all([
    prisma.examResult.findMany({
      where: { schoolId, studentId: { in: classmateIds } },
      include: {
        exam: { select: { id: true, name: true, examDate: true } },
        subjectRef: { select: { id: true, name: true } }
      },
      orderBy: [{ examDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.homeworkRecord.findMany({
      where: { schoolId, studentId: { in: classmateIds } },
      include: { subjectRef: { select: { id: true, name: true } } }
    })
  ]);

  const typedResults = results as AcademicExamResult[];
  const typedHomework = homeworkRecords as AcademicHomeworkRecord[];
  const studentResults = typedResults.filter((result) => result.studentId === studentId);

  const examRows = studentResults.map((result) => {
    const key = examSubjectKey(result);
    const comparable = typedResults.filter((item) => examSubjectKey(item) === key);
    const percent = percentage(result.marksObtained, result.maxMarks);
    const studentScores = new Map<string, number[]>();

    comparable.forEach((item) => {
      const scores = studentScores.get(item.studentId) ?? [];
      scores.push(percentage(item.marksObtained, item.maxMarks));
      studentScores.set(item.studentId, scores);
    });

    const ranked = Array.from(studentScores.entries())
      .map(([rankedStudentId, scores]) => ({ studentId: rankedStudentId, percentage: Math.round(averageNumber(scores)) }))
      .sort((a, b) => b.percentage - a.percentage || a.studentId.localeCompare(b.studentId));

    const rankIndex = ranked.findIndex((item) => item.studentId === studentId);

    return {
      id: result.id,
      examName: examName(result),
      subject: subjectName(result),
      marks: `${toNumber(result.marksObtained)}/${toNumber(result.maxMarks)}`,
      percentage: percent,
      classAverage: Math.round(averageNumber(comparable.map((item) => percentage(item.marksObtained, item.maxMarks)))),
      grade: gradeForPercentage(percent),
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      examDate: result.exam?.examDate ?? result.examDate
    };
  });

  const trend = Array.from(
    studentResults.reduce((groups, result) => {
      const key = examKey(result);
      const existing = groups.get(key) ?? {
        key,
        examName: examName(result),
        examDate: result.exam?.examDate ?? result.examDate,
        studentScores: [] as number[],
        classScores: [] as number[]
      };
      existing.studentScores.push(percentage(result.marksObtained, result.maxMarks));
      existing.classScores = typedResults
        .filter((item) => examKey(item) === key)
        .map((item) => percentage(item.marksObtained, item.maxMarks));
      groups.set(key, existing);
      return groups;
    }, new Map<string, { key: string; examName: string; examDate: Date; studentScores: number[]; classScores: number[] }>())
  ).map(([, group]) => ({
    examName: group.examName,
    examDate: group.examDate,
    student: Math.round(averageNumber(group.studentScores)),
    classAverage: Math.round(averageNumber(group.classScores))
  }))
    .sort((a, b) => a.examDate.getTime() - b.examDate.getTime())
    .slice(-5);

  const subjectKeys = new Map<string, string>();
  typedResults.forEach((result) => subjectKeys.set(subjectKeyFromResult(result), subjectName(result)));
  typedHomework.forEach((record) => subjectKeys.set(subjectKeyFromHomework(record), homeworkSubjectName(record)));

  const subjects = Array.from(subjectKeys.entries())
    .map(([key, label]) => {
      const classResults = typedResults.filter((result) => subjectKeyFromResult(result) === key);
      const ownResults = classResults.filter((result) => result.studentId === studentId);
      const ownHomework = typedHomework.filter((record) => record.studentId === studentId && subjectKeyFromHomework(record) === key);

      return {
        subject: label,
        studentAverage: ownResults.length
          ? Math.round(averageNumber(ownResults.map((result) => percentage(result.marksObtained, result.maxMarks))))
          : 0,
        classAverage: classResults.length
          ? Math.round(averageNumber(classResults.map((result) => percentage(result.marksObtained, result.maxMarks))))
          : 0,
        homeworkCompletion: ownHomework.length
          ? Math.round(averageNumber(ownHomework.map((record) => clampPercentage(toNumber(record.completionPercentage)))))
          : 0
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    exams: examRows,
    trend,
    subjects
  };
}

function performanceSnapshot(
  examResults: ExamForPerformance[],
  homeworkRecords: HomeworkForPerformance[],
  attendancePercentage: number,
  homeworkCompletionOverride?: number | null
) {
  // Weight each exam by its max-marks: a 100-mark final counts more than a 5-mark
  // quiz. examAverage = total marks obtained / total max-marks across all exams.
  let totalObtained = 0;
  let totalMax = 0;
  for (const result of examResults) {
    const maxMarks = toNumber(result.maxMarks);
    if (maxMarks <= 0) continue;
    totalObtained += toNumber(result.marksObtained);
    totalMax += maxMarks;
  }
  const examAverage = totalMax > 0 ? Math.round(clampPercentage((totalObtained / totalMax) * 100)) : null;

  const homeworkCompletion =
    homeworkCompletionOverride ??
    average(homeworkRecords.map((record) => clampPercentage(toNumber(record.completionPercentage))));

  const performanceRate =
    examAverage === null || homeworkCompletion === null
      ? null
      : Math.round((examAverage * 0.6) + (homeworkCompletion * 0.2) + (attendancePercentage * 0.2));

  return {
    examAverage,
    homeworkCompletion,
    attendancePercentage,
    performanceRate,
    performanceClassification: classifyPerformance(performanceRate)
  };
}

async function currentRankForStudent(schoolId: string, classId: string, studentId: string) {
  const classmates = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: {
      id: true,
      fullName: true,
      examResults: { select: { marksObtained: true, maxMarks: true } },
      homeworkRecords: { select: { completionPercentage: true } },
      attendanceRecords: {
        take: 60,
        orderBy: { createdAt: "desc" },
        select: { status: true, attendanceValue: true, session: { select: { date: true } } }
      },
      feeAssignments: { select: { pendingAmount: true } }
    }
  });

  // Only students with a real performance score are ranked against each other, so
  // the comparison stays apples-to-apples (a no-data student's attendance % must
  // not compete against another student's performance %). No-data students are
  // unranked and the profile shows "Not ranked" for them.
  const ranked = classmates
    .map((classmate) => {
      const attendancePercentage = attendanceSnapshot(classmate.attendanceRecords).attendancePercentage;
      return {
        id: classmate.id,
        fullName: classmate.fullName,
        performanceRate: performanceSnapshot(classmate.examResults, classmate.homeworkRecords, attendancePercentage).performanceRate,
        feeBalance: classmate.feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0)
      };
    })
    .filter((item): item is typeof item & { performanceRate: number } => item.performanceRate !== null)
    .sort(
      (a, b) =>
        b.performanceRate - a.performanceRate ||
        a.feeBalance - b.feeBalance ||
        a.fullName.localeCompare(b.fullName)
    );

  const rank = ranked.findIndex((item) => item.id === studentId);
  return rank >= 0 ? rank + 1 : null;
}

function getFeeStatusFilter(feeStatus: string) {
  switch (feeStatus) {
    case "OVERDUE":
      return {
        feeAssignments: {
          some: {
            status: "OVERDUE" as const
          }
        }
      };
    case "PENDING":
      return {
        feeAssignments: {
          some: {
            pendingAmount: { gt: new Prisma.Decimal(0) }
          },
          none: {
            status: "OVERDUE" as const
          }
        }
      };
    case "PAID":
      return {
        feeAssignments: {
          none: {
            OR: [
              { status: "OVERDUE" as const },
              { pendingAmount: { gt: new Prisma.Decimal(0) } }
            ]
          }
        }
      };
    default:
      return {};
  }
}

export async function listStudents(user: Express.UserContext, query: unknown) {
  return withRetry(async () => {
    const pagination = getPagination(query);
    const accessFilter = await studentAccessFilter(user);
    const allowedTabs = allowedTabsForRole(user.role);
    const canViewAcademic = hasTab(allowedTabs, "academic");
    const canViewHomework = hasTab(allowedTabs, "homework");
    const canViewFees = hasTab(allowedTabsForRole(user.role), "fees");

    const { classId, feeStatus } = (query || {}) as { classId?: string; feeStatus?: string };
    const canViewAttendance = hasTab(allowedTabs, "attendance");

    const feeFilter = (canViewFees && feeStatus) ? getFeeStatusFilter(feeStatus) : {};

    const where = {
      schoolId: user.schoolId,
      ...(classId ? { classId } : {}),
      ...accessFilter,
      ...(pagination.search
        ? {
            OR: [
              { fullName: { contains: pagination.search, mode: "insensitive" as const } },
              { admissionNumber: { contains: pagination.search, mode: "insensitive" as const } },
              { parentPhone: { contains: pagination.search } }
            ]
          }
        : {}),
      ...((query as any).showInactive === "true" || (query as any).showInactive === true ? { isActive: false } : { isActive: true }),
      ...feeFilter
    };

    const [records, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          class: { select: { id: true, name: true, section: true, academicYear: true } },
          ...(canViewAcademic ? { examResults: { select: { marksObtained: true, maxMarks: true } } } : {}),
          ...(canViewAcademic || canViewHomework ? { homeworkRecords: { select: { completionPercentage: true } } } : {}),
          ...(canViewFees
            ? {
                feeAssignments: {
                  select: {
                    id: true,
                    pendingAmount: true,
                    status: true,
                    payments: {
                      select: { paidAt: true },
                      orderBy: { paidAt: "desc" },
                      take: 1
                    }
                  }
                }
              }
            : {}),
          ...(canViewAttendance || canViewAcademic
            ? {
                attendanceRecords: {
                  take: 60,
                  orderBy: { createdAt: "desc" },
                  select: {
                    status: true,
                    attendanceValue: true,
                    session: { select: { date: true } }
                  }
                }
              }
            : {})
        },
        orderBy: [{ class: { name: "asc" } }, { class: { section: "asc" } }, { fullName: "asc" }]
      }),
      prisma.student.count({ where })
    ]);

    const homeworkCompletionOverrides = canViewAcademic
      ? await homeworkCompletionOverridesForStudents(
          user.schoolId,
          records.map((record) => ({ id: record.id, classId: record.classId }))
        )
      : new Map<string, number | null>();

    const items = records.map((record) => {
      const student = record as typeof record & {
        attendanceRecords?: AttendanceForSnapshot[];
        examResults?: ExamForPerformance[];
        homeworkRecords?: HomeworkForPerformance[];
      };
      const feeRows = (student as unknown as {
        feeAssignments?: {
          id: string;
          pendingAmount: unknown;
          status: unknown;
          payments?: { paidAt: Date }[];
        }[];
      }).feeAssignments;
      const latestPayment = feeRows
        ?.flatMap((assignment) => assignment.payments ?? [])
        .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime())[0]?.paidAt ?? null;
      const feeAssignments = feeRows?.map(({ payments: _payments, ...assignment }) => assignment);
      const feeBalance = feeRows?.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0) ?? 0;
      const attendancePercentage =
        canViewAttendance || canViewAcademic
          ? attendanceSnapshot(student.attendanceRecords ?? []).attendancePercentage
          : 0;
      const performance = canViewAcademic
        ? performanceSnapshot(student.examResults ?? [], student.homeworkRecords ?? [], attendancePercentage, homeworkCompletionOverrides.get(student.id))
        : {
            examAverage: null,
            homeworkCompletion: null,
            attendancePercentage,
            performanceRate: null,
            performanceClassification: null
          };
      const { attendanceRecords: _attendanceRecords, feeAssignments: _feeAssignments, examResults: _examResults, homeworkRecords: _homeworkRecords, consentGiven, consentGivenAt, consentGivenBy, consentMethod, ...payload } = student as any;
      // Consent records are admin-only data — exclude from non-Principal/Admin responses.
      const consentFields = isPrincipalRole(user.role)
        ? { consentGiven, consentGivenAt, consentGivenBy, consentMethod }
        : {};

      return {
        ...payload,
        ...consentFields,
        ...performance,
        ...(canViewFees ? { feeAssignments, lastPayment: latestPayment, feeBalance } : {}),
        ...(canViewAttendance
          ? { attendancePercentage }
          : {})
      };
    });

    return { items, total, page: pagination.page, limit: pagination.limit };
  }, { label: "listStudents" });
}

export async function getStudent(user: Express.UserContext, id: string) {
  return withRetry(async () => {
    const allowedTabs = allowedTabsForRole(user.role);
    const canViewAcademic = hasTab(allowedTabs, "academic");
    const canViewHomework = hasTab(allowedTabs, "homework");
    const canViewAttendance = hasTab(allowedTabs, "attendance");
    const canViewFees = hasTab(allowedTabs, "fees");
    const canViewCommunication = hasTab(allowedTabs, "communication");
    const canViewBehaviour = hasTab(allowedTabs, "behaviour");
    const canViewDocuments = hasTab(allowedTabs, "documents");
    const accessFilter = await studentAccessFilter(user);

    const student = await prisma.student.findFirst({
      where: {
        id,
        schoolId: user.schoolId,
        ...accessFilter
      },
      include: {
        class: true,
        ...(canViewAcademic ? { examResults: { select: { marksObtained: true, maxMarks: true } } } : {}),
        ...(canViewHomework ? { homeworkRecords: { select: { completionPercentage: true } } } : {}),
        ...(canViewFees ? { feeAssignments: { include: { feeStructure: true, payments: { include: { receipt: true } } }, orderBy: { assignedAt: "desc" } } } : {}),
        ...(canViewAttendance || canViewAcademic
          ? {
              attendanceRecords: {
                take: 60,
                orderBy: { createdAt: "desc" },
                include: { session: { select: { date: true, classId: true } } }
              }
            }
          : {})
      }
    });
    if (!student) throw notFound("Student");

    const siblings = student.parentPhone
      ? await prisma.student.findMany({
          where: {
            schoolId: user.schoolId,
            parentPhone: student.parentPhone,
            id: { not: student.id }
          },
          select: {
            id: true,
            fullName: true,
            class: { select: { name: true, section: true } },
            profilePhotoUrl: true
          }
        })
      : [];

    const studentRecord = student as typeof student & {
      attendanceRecords?: AttendanceForSnapshot[];
      examResults?: ExamForPerformance[];
      homeworkRecords?: HomeworkForPerformance[];
      feeAssignments?: { pendingAmount: unknown }[];
    };
    const attendanceRecords = studentRecord.attendanceRecords ?? [];
    const examResults = studentRecord.examResults ?? [];
    const homeworkRecords = studentRecord.homeworkRecords ?? [];
    const feeAssignments = studentRecord.feeAssignments ?? [];
    const { attendancePercentage, lastAbsentDate } =
      canViewAttendance || canViewAcademic ? attendanceSnapshot(attendanceRecords) : { attendancePercentage: 0, lastAbsentDate: null };
    const [attendanceClassAverage, homework] = await Promise.all([
      canViewAttendance
        ? cached(`attendance-class-average:${user.schoolId}:${student.classId}`, 30_000, () => classAverageAttendance(user.schoolId, student.classId))
        : Promise.resolve(null),
      canViewHomework
        ? cached(`homework:${user.schoolId}:${student.classId}:${student.id}`, 30_000, () => homeworkAnalytics(user.schoolId, student.classId, student.id))
        : Promise.resolve(emptyHomeworkAnalytics())
    ]);
    const attendance = canViewAttendance ? attendanceAnalytics(attendanceRecords, attendanceClassAverage) : emptyAttendanceAnalytics();
    const performance = canViewAcademic
      ? performanceSnapshot(examResults, homeworkRecords, attendancePercentage, homework.completionPercentage)
      : {
          examAverage: null,
          homeworkCompletion: null,
          attendancePercentage,
          performanceRate: null,
          performanceClassification: null
        };
    const analytics = canViewAcademic
      ? await cached(`academic:${user.schoolId}:${student.classId}:${student.id}`, 30_000, () => academicAnalytics(user.schoolId, student.classId, student.id))
      : { exams: [], trend: [], subjects: [] };
    const communication = canViewCommunication ? await communicationAudit(user, student.id) : [];
    const behaviour = canViewBehaviour ? await behaviourAnalytics(user, student.id) : emptyBehaviourAnalytics(user.role);
    const documents = canViewDocuments ? await documentAudit(user.schoolId, student.id) : [];
    const editHistory = isPrincipalRole(user.role)
      ? await prisma.auditLog.findMany({
          where: { schoolId: user.schoolId, entityType: "STUDENT", entityId: student.id },
          include: { actor: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: 25
        })
      : [];
    const feeBalance = canViewFees ? feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0) : 0;
    const currentRank = canViewAcademic
      ? await cached(`rank:${user.schoolId}:${student.classId}:${student.id}`, 30_000, () => currentRankForStudent(user.schoolId, student.classId, student.id))
      : null;
    const {
      examResults: _examResults,
      homeworkRecords: _homeworkRecords,
      feeAssignments: _feeAssignments,
      attendanceRecords: _attendanceRecords,
      consentGiven,
      consentGivenAt,
      consentGivenBy,
      consentMethod,
      ...studentPayload
    } = studentRecord as any;

    // Consent records are admin-only data — exclude from TEACHER/ACCOUNTANT/PARENT responses.
    const consentFields = isPrincipalRole(user.role)
      ? { consentGiven, consentGivenAt, consentGivenBy, consentMethod }
      : {};

    return {
      ...studentPayload,
      ...consentFields,
      access: {
        role: user.role,
        allowedTabs
      },
      siblings,
      lastAbsentDate,
      currentRank,
      ...performance,
      academicAnalytics: analytics,
      homeworkAnalytics: homework,
      attendanceAnalytics: attendance,
      communicationAudit: communication,
      behaviourAnalytics: behaviour,
      documents,
      editHistory: editHistory.map((entry) => ({
        id: entry.id,
        action: entry.action,
        summary: entry.summary,
        createdAt: entry.createdAt,
        actor: entry.actor ? { id: entry.actor.id, fullName: entry.actor.fullName, role: entry.actor.role } : null
      })),
      feeAssignments: canViewFees ? feeAssignments : [],
      attendanceRecords: canViewAttendance ? attendanceRecords : [],
      feeBalance
    };
  }, { label: "getStudent" });
}

export async function uploadStudentDocument(
  user: Express.UserContext,
  studentId: string,
  data: Record<string, unknown>,
  file?: Express.Multer.File
) {
  return withRetry(async () => {
    if (!isPrincipalRole(user.role)) {
      throw new AppError(403, "Only Principal/Admin users can manage student documents", "FORBIDDEN");
    }
    if (!file) {
      throw new AppError(400, "Document file is required", "DOCUMENT_FILE_REQUIRED");
    }
    if (!allowedDocumentMimeTypes.has(file.mimetype)) {
      throw new AppError(400, "Unsupported document file type", "UNSUPPORTED_DOCUMENT_TYPE", { mimeType: file.mimetype });
    }

    const payload = data as { type: StudentDocumentType; name?: string };
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: user.schoolId
      },
      select: { id: true }
    });
    if (!student) throw notFound("Student");

    const documentId = randomUUID();
    const safeFileName = sanitizeFileName(file.originalname);
    const storageKey = `${env.S3_KEY_PREFIX}/${user.schoolId}/${student.id}/${documentId}-${safeFileName}`;

    const { storageKey: savedKey, storageProvider } = await uploadFile({
      buffer: file.buffer,
      key: storageKey,
      mimeType: file.mimetype,
      originalName: file.originalname
    });

    const document = await prisma.studentDocument.create({
      data: {
        id: documentId,
        schoolId: user.schoolId,
        studentId: student.id,
        uploadedById: user.id,
        type: payload.type,
        name: payload.name?.trim() || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: savedKey,
        storageProvider
      },
      include: { uploadedBy: { select: { id: true, fullName: true, role: true } } }
    });

    return documentResponse(document);
  }, { label: "uploadStudentDocument" });
}

export async function downloadStudentDocument(user: Express.UserContext, studentId: string, documentId: string) {
  // Auth check — unchanged: only Principal/Admin may download student documents.
  if (!isPrincipalRole(user.role)) {
    throw new AppError(403, "Only Principal/Admin users can download student documents", "FORBIDDEN");
  }

  const document = await prisma.studentDocument.findFirst({
    where: {
      id: documentId,
      studentId,
      schoolId: user.schoolId
    },
    select: {
      originalName: true,
      storageKey: true
    }
  });
  if (!document) throw notFound("Document");
  if (!document.storageKey) throw notFound("Document file");

  // S3: short-lived presigned URL. Local: the storage key (controller serves it).
  const downloadUrl = await getDownloadUrl(document.storageKey);

  return { downloadUrl, fileName: document.originalName };
}

export async function deleteStudentDocument(user: Express.UserContext, studentId: string, documentId: string) {
  return withRetry(async () => {
    if (!isPrincipalRole(user.role)) {
      throw new AppError(403, "Only Principal/Admin users can delete student documents", "FORBIDDEN");
    }

    const document = await prisma.studentDocument.findFirst({
      where: {
        id: documentId,
        studentId,
        schoolId: user.schoolId
      },
      select: { id: true, storageKey: true }
    });
    if (!document) throw notFound("Document");

    if (document.storageKey) {
      await deleteFile(document.storageKey);
    }
    await prisma.studentDocument.delete({ where: { id: document.id } });

    return { id: document.id };
  }, { label: "deleteStudentDocument" });
}

export async function createBehaviourRecord(user: Express.UserContext, studentId: string, data: Record<string, unknown>) {
  return withRetry(async () => {
    const payload = data as {
      type: BehaviourType;
      title: string;
      summary: string;
      severity?: BehaviourSeverity;
      occurredAt?: Date;
      isRestricted?: boolean;
      actionTaken?: string;
    };

    if (user.role !== UserRole.TEACHER) {
      throw new AppError(403, "Only teachers can create behaviour records", "FORBIDDEN");
    }

    if (payload.type === BehaviourType.COUNSELLOR_NOTE) {
      throw new AppError(403, "Teachers cannot create counsellor notes", "FORBIDDEN");
    }

    if (payload.isRestricted) {
      throw new AppError(403, "Restricted behaviour notes are limited to Principal/Admin roles", "FORBIDDEN");
    }

    if (payload.actionTaken?.trim()) {
      throw new AppError(403, "Action taken must be recorded by Principal/Admin users", "FORBIDDEN");
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: user.schoolId,
        class: {
          OR: [
            { classTeacherId: user.id },
            { teacherPeriodAssignments: { some: { teacherId: user.id } } }
          ]
        }
      },
      select: { id: true }
    });
    if (!student) throw notFound("Student");

    return prisma.behaviourRecord.create({
      data: {
        schoolId: user.schoolId,
        studentId: student.id,
        createdById: user.id,
        type: payload.type,
        title: payload.title,
        summary: payload.summary,
        severity: payload.severity,
        occurredAt: payload.occurredAt ?? new Date(),
        isRestricted: false,
        actionTaken: null
      },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }, { label: "createBehaviourRecord" });
}

export async function updateBehaviourAction(user: Express.UserContext, studentId: string, recordId: string, data: Record<string, unknown>) {
  return withRetry(async () => {
    if (!isPrincipalRole(user.role)) {
      throw new AppError(403, "Only Principal/Admin users can record behaviour actions", "FORBIDDEN");
    }

    const payload = data as { actionTaken: string };
    const record = await prisma.behaviourRecord.findFirst({
      where: {
        id: recordId,
        studentId,
        schoolId: user.schoolId,
        type: BehaviourType.INCIDENT
      },
      select: { id: true }
    });
    if (!record) throw notFound("Behaviour record");

    return prisma.behaviourRecord.update({
      where: { id: record.id },
      data: { actionTaken: payload.actionTaken.trim() },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }, { label: "updateBehaviourAction" });
}

export async function generateAdmissionNumber(schoolId: string) {
  const currentYear = new Date().getFullYear();
  const prefix = `ADM-${currentYear}-`;
  
  const lastStudent = await prisma.student.findFirst({
    where: { schoolId, admissionNumber: { startsWith: prefix } },
    orderBy: { admissionNumber: "desc" },
    select: { admissionNumber: true }
  });

  let nextSequence = 1;
  if (lastStudent) {
    const parts = lastStudent.admissionNumber.split("-");
    const lastSequence = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

export async function createStudent(user: Express.UserContext, data: Record<string, unknown>) {
  const { feeStructureId, ...studentData } = data as { feeStructureId?: string } & Record<string, unknown>;
  const schoolId = user.schoolId;
  
  if (!studentData.admissionNumber) {
    studentData.admissionNumber = await generateAdmissionNumber(schoolId);
  }

  const student = await prisma.student.create({
    data: {
      ...studentData,
      schoolId,
      transportRequired: Boolean(studentData.transportRequired),
      transportFeeAmount: studentData.transportRequired ? Number(studentData.transportFeeAmount ?? 0) : 0,
      joiningDate: studentData.joiningDate ? new Date(studentData.joiningDate as string) : new Date(),
      dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth as string) : null,
      consentGiven: data.consentGiven ?? false,
      consentGivenAt: data.consentGiven ? new Date() : null,
      consentGivenBy: data.consentGivenBy ?? null,
      consentMethod: data.consentMethod ?? null,
    } as never
  });

  if (!data.consentGiven) {
    logger.warn({
      evt: "compliance.consent_missing",
      studentId: student.id,
      schoolId,
      message: "Student created without guardian consent recorded (DPDP requirement)"
    });
  }

  if (feeStructureId) {
    await assignFee(schoolId, student.id, feeStructureId);
  }

  await recordAuditLog({
    schoolId,
    actorId: user.id,
    entityType: "STUDENT",
    entityId: student.id,
    action: "CREATE",
    summary: `Created student ${student.fullName}`,
    after: student
  });

  return student;
}

export async function importStudents(user: Express.UserContext, rows: Record<string, unknown>[]) {
  const students = [];

  for (let index = 0; index < rows.length; index += 1) {
    try {
      students.push(await createStudent(user, rows[index]));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import student";
      throw new AppError(400, `Row ${index + 2}: ${message}`, "STUDENT_IMPORT_ROW_FAILED");
    }
  }

  return {
    importedCount: students.length,
    students
  };
}

export async function updateStudent(user: Express.UserContext, id: string, data: Record<string, unknown>) {
  const schoolId = user.schoolId;
  const { feeStructureId, ...studentData } = data as { feeStructureId?: string } & Record<string, unknown>;
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  const updated = await prisma.$transaction(async (tx) => {
    const student = await tx.student.update({ where: { id }, data: studentData });
    const transportChanged = "transportRequired" in studentData || "transportFeeAmount" in studentData;

    if (feeStructureId || transportChanged) {
      const selectedFeeStructure = feeStructureId ? await tx.feeStructure.findFirst({ where: { id: feeStructureId, schoolId } }) : null;
      if (feeStructureId && !selectedFeeStructure) throw notFound("Fee structure");

      const latestAssignment = await tx.studentFeeAssignment.findFirst({
        where: { schoolId, studentId: id },
        include: { adjustments: true, feeStructure: true },
        orderBy: { assignedAt: "desc" }
      });
      const targetAssignment = feeStructureId
        ? await tx.studentFeeAssignment.findFirst({
            where: { schoolId, studentId: id, feeStructureId },
            include: { adjustments: true, feeStructure: true }
          })
        : latestAssignment;
      const assignment = targetAssignment ?? latestAssignment;
      const feeStructure = selectedFeeStructure ?? assignment?.feeStructure;

      if (feeStructure) {
        const transportFeeAmount = student.transportRequired ? toMoney(toNumber(student.transportFeeAmount)) : 0;
        const grossTotal = toMoney(toNumber(feeStructure.totalAmount) + transportFeeAmount);

        if (assignment) {
          const paidAmount = toMoney(toNumber(assignment.paidAmount));
          const adjustmentTotal = toMoney(assignment.adjustments.reduce((sum, adjustment) => sum + toNumber(adjustment.amount), 0));
          const netTotal = toMoney(grossTotal - adjustmentTotal);

          if (netTotal < paidAmount) {
            throw new AppError(400, "Selected fee structure total is lower than the amount already paid", "FEE_STRUCTURE_TOTAL_BELOW_PAID");
          }

          const pendingAmount = toMoney(netTotal - paidAmount);
          await tx.studentFeeAssignment.update({
            where: { id: assignment.id },
            data: {
              feeStructureId: feeStructure.id,
              totalAmount: netTotal,
              transportFeeAmount,
              pendingAmount,
              status: feeStatus(pendingAmount, paidAmount)
            }
          });
        } else {
          await tx.studentFeeAssignment.create({
            data: {
              schoolId,
              studentId: id,
              feeStructureId: feeStructure.id,
              totalAmount: grossTotal,
              transportFeeAmount,
              pendingAmount: grossTotal,
              status: InstallmentStatus.PENDING
            }
          });
        }
      }
    }

    return student;
  });
  await recordAuditLog({
    schoolId,
    actorId: user.id,
    entityType: "STUDENT",
    entityId: id,
    action: "UPDATE",
    summary: `Updated student ${updated.fullName}`,
    before: existing,
    after: updated
  });
  return updated;
}

export async function deactivateStudent(user: Express.UserContext, id: string) {
  const schoolId = user.schoolId;
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  const updated = await prisma.student.update({ where: { id }, data: { isActive: false } });
  await recordAuditLog({
    schoolId,
    actorId: user.id,
    entityType: "STUDENT",
    entityId: id,
    action: "DEACTIVATE",
    summary: `Marked ${updated.fullName} inactive`,
    before: existing,
    after: updated
  });
  return updated;
}

export async function activateStudent(user: Express.UserContext, id: string) {
  const schoolId = user.schoolId;
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  const updated = await prisma.student.update({ where: { id }, data: { isActive: true } });
  await recordAuditLog({
    schoolId,
    actorId: user.id,
    entityType: "STUDENT",
    entityId: id,
    action: "ACTIVATE",
    summary: `Marked ${updated.fullName} active`,
    before: existing,
    after: updated
  });
  return updated;
}
