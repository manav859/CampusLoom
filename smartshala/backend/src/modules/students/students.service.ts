import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AttendanceStatus,
  BehaviourSeverity,
  BehaviourType,
  HomeworkSubmissionStatus,
  NotificationKind,
  StudentDocumentType,
  UserRole
} from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { AppError, notFound } from "../../core/errors.js";
import { assignFee } from "../fees/fees.service.js";

type AttendanceForSnapshot = {
  status: AttendanceStatus;
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
const teacherTabs: StudentProfileTab[] = ["academic", "homework", "attendance", "communication"];
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
  if (user.role === UserRole.TEACHER) return { class: { classTeacherId: user.id } };
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
    counts: { total: 0, onTime: 0, late: 0, missing: 0 },
    currentStreak: 0,
    subjects: [],
    assignments: []
  };
}

function emptyAttendanceAnalytics() {
  return {
    records: [],
    calendar: [],
    metrics: { attendancePercentage: 0, totalDays: 0, absences: 0, late: 0, remainingBefore75: 0 },
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

function documentStorageRoot() {
  return path.resolve(process.cwd(), "uploads", "student-documents");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "document";
}

function safeDocumentPath(storageKey: string) {
  const root = documentStorageRoot();
  const filePath = path.resolve(root, storageKey);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError(400, "Invalid document storage key", "INVALID_DOCUMENT_PATH");
  }
  return filePath;
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
  const now = new Date();
  const currentMonthRecords = records.filter((record) => {
    const date = record.session.date;
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const scopedRecords = currentMonthRecords.length > 0 ? currentMonthRecords : records;
  const total = scopedRecords.length;
  const attended = scopedRecords.filter((record) => record.status !== AttendanceStatus.ABSENT).length;
  const lastAbsentRecord = records
    .filter((record) => record.status === AttendanceStatus.ABSENT)
    .sort((a, b) => b.session.date.getTime() - a.session.date.getTime())[0];

  return {
    attendancePercentage: total ? Math.round((attended / total) * 100) : 0,
    lastAbsentDate: lastAbsentRecord?.session.date ?? null
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

function attendanceAnalytics(records: AttendanceForSnapshot[]) {
  const sortedRecords = [...records].sort((a, b) => a.session.date.getTime() - b.session.date.getTime());
  const attendanceRows = sortedRecords.map((record) => ({
    date: record.session.date,
    status: record.status
  }));

  const totalDays = attendanceRows.length;
  const absences = attendanceRows.filter((record) => record.status === AttendanceStatus.ABSENT).length;
  const late = attendanceRows.filter((record) => record.status === AttendanceStatus.LATE).length;
  const attended = attendanceRows.filter((record) => record.status !== AttendanceStatus.ABSENT).length;
  const attendancePercentage = totalDays ? Math.round((attended / totalDays) * 100) : 0;
  const remainingBefore75 = totalDays ? Math.max(0, Math.floor((attended / 0.75) - totalDays)) : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const recordByDate = new Map(attendanceRows.map((record) => [isoDate(record.date), record.status]));
  const calendar: { date: Date; status: AttendanceStatus | "HOLIDAY" | "UNMARKED" }[] = [];

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const key = isoDate(date);
    const status = recordByDate.get(key) ?? (date.getDay() === 0 ? "HOLIDAY" : "UNMARKED");
    calendar.push({ date, status });
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
      attendancePercentage,
      totalDays,
      absences,
      late,
      remainingBefore75
    },
    cbseWarning: attendancePercentage > 0 && attendancePercentage < 80,
    repeatedWeekdayAbsences
  };
}

function percentage(marksObtained: unknown, maxMarks: unknown) {
  const max = toNumber(maxMarks);
  if (max <= 0) return 0;
  return Math.round(clampPercentage((toNumber(marksObtained) / max) * 100));
}

function gradeForPercentage(value: number) {
  if (value >= 90) return "A+";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "D";
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

function normalizeHomeworkStatus(assignment: HomeworkAssignmentForAnalytics) {
  const submission = assignment.submissions[0];
  if (submission) return submission.status;
  return assignment.dueDate.getTime() < Date.now() ? HomeworkSubmissionStatus.NOT_SUBMITTED : null;
}

function isHomeworkNotSubmitted(status: HomeworkSubmissionStatus | "PENDING" | string) {
  return status === HomeworkSubmissionStatus.MISSING || status === HomeworkSubmissionStatus.NOT_SUBMITTED;
}

function homeworkAnalyticsFromAssignments(assignments: HomeworkAssignmentForAnalytics[]) {
  const total = assignments.length;
  const log = assignments
    .map((assignment) => {
      const submission = assignment.submissions[0];
      const status = normalizeHomeworkStatus(assignment);

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
  const completionPercentage = total ? Math.round((onTime / total) * 100) : null;

  const currentStreak = [...log]
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
    .reduce((streak, item) => {
      if (streak.stopped) return streak;
      if (item.status === HomeworkSubmissionStatus.ON_TIME) return { count: streak.count + 1, stopped: false };
      if (item.status === "PENDING") return streak;
      return { ...streak, stopped: true };
    }, { count: 0, stopped: false }).count;

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
    counts: { total, onTime, late, missing },
    currentStreak,
    subjects,
    assignments: log
  };
}

async function homeworkAnalytics(schoolId: string, classId: string, studentId: string) {
  const assignments = await prisma.homeworkAssignment.findMany({
    where: { schoolId, classId },
    include: {
      subjectRef: { select: { id: true, name: true } },
      submissions: {
        where: { studentId },
        select: { status: true, marks: true, teacherNote: true, submittedAt: true }
      }
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }]
  });

  return homeworkAnalyticsFromAssignments(assignments as HomeworkAssignmentForAnalytics[]);
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
      reference: notification.kind
    })),
    ...communicationLogs.map((log) => ({
      id: log.id,
      type: log.type,
      channel: log.channel,
      summary: log.summary,
      status: log.status,
      timestamp: log.timestamp,
      source: "communication_log",
      reference: log.messageType
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
  const examAverage = average(
    examResults
      .map((result) => {
        const maxMarks = toNumber(result.maxMarks);
        if (maxMarks <= 0) return null;
        return clampPercentage((toNumber(result.marksObtained) / maxMarks) * 100);
      })
      .filter((value): value is number => value !== null)
  );

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
        select: { status: true, session: { select: { date: true } } }
      },
      feeAssignments: { select: { pendingAmount: true } }
    }
  });

  const ranked = classmates
    .map((classmate) => ({
      id: classmate.id,
      fullName: classmate.fullName,
      attendancePercentage: attendanceSnapshot(classmate.attendanceRecords).attendancePercentage,
      performanceRate: performanceSnapshot(
        classmate.examResults,
        classmate.homeworkRecords,
        attendanceSnapshot(classmate.attendanceRecords).attendancePercentage
      ).performanceRate,
      feeBalance: classmate.feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0)
    }))
    .sort(
      (a, b) =>
        (b.performanceRate ?? b.attendancePercentage) - (a.performanceRate ?? a.attendancePercentage) ||
        a.feeBalance - b.feeBalance ||
        a.fullName.localeCompare(b.fullName)
    );

  const rank = ranked.findIndex((item) => item.id === studentId);
  return rank >= 0 ? rank + 1 : null;
}

export async function listStudents(user: Express.UserContext, query: unknown) {
  return withRetry(async () => {
    const pagination = getPagination(query);
    const accessFilter = await studentAccessFilter(user);
    const canViewFees = hasTab(allowedTabsForRole(user.role), "fees");

    const { classId } = (query || {}) as { classId?: string };

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
      ...((query as any).showInactive === "true" || (query as any).showInactive === true ? { isActive: false } : { isActive: true })
    };

    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          class: { select: { id: true, name: true, section: true, academicYear: true } },
          ...(canViewFees ? { feeAssignments: { select: { id: true, pendingAmount: true, status: true } } } : {})
        },
        orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { fullName: "asc" }]
      }),
      prisma.student.count({ where })
    ]);

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
        ...(canViewFees ? { feeAssignments: { include: { feeStructure: true, payments: { include: { receipt: true } } } } } : {}),
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
    const attendance = canViewAttendance ? attendanceAnalytics(attendanceRecords) : emptyAttendanceAnalytics();
    const homework = canViewHomework
      ? await cached(`homework:${user.schoolId}:${student.classId}:${student.id}`, 30_000, () => homeworkAnalytics(user.schoolId, student.classId, student.id))
      : emptyHomeworkAnalytics();
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
    const feeBalance = canViewFees ? feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0) : 0;
    const currentRank = canViewAcademic
      ? await cached(`rank:${user.schoolId}:${student.classId}:${student.id}`, 30_000, () => currentRankForStudent(user.schoolId, student.classId, student.id))
      : null;
    const { examResults: _examResults, homeworkRecords: _homeworkRecords, feeAssignments: _feeAssignments, attendanceRecords: _attendanceRecords, ...studentPayload } =
      studentRecord as any;

    return {
      ...studentPayload,
      access: {
        role: user.role,
        allowedTabs
      },
      lastAbsentDate,
      currentRank,
      ...performance,
      academicAnalytics: analytics,
      homeworkAnalytics: homework,
      attendanceAnalytics: attendance,
      communicationAudit: communication,
      behaviourAnalytics: behaviour,
      documents,
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
    const originalName = sanitizeFileName(file.originalname);
    const storageKey = path.join(user.schoolId, student.id, `${documentId}-${originalName}`);
    const filePath = safeDocumentPath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer);

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
        storageKey
      },
      include: { uploadedBy: { select: { id: true, fullName: true, role: true } } }
    });

    return documentResponse(document);
  }, { label: "uploadStudentDocument" });
}

export async function getStudentDocumentFile(user: Express.UserContext, studentId: string, documentId: string) {
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
      mimeType: true,
      storageKey: true
    }
  });
  if (!document) throw notFound("Document");

  const filePath = safeDocumentPath(document.storageKey);
  await access(filePath).catch(() => {
    throw notFound("Document file");
  });

  return {
    filePath,
    originalName: document.originalName,
    mimeType: document.mimeType
  };
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

    if (!isPrincipalRole(user.role)) {
      throw new AppError(403, "Only Principal/Admin users can manage behaviour records", "FORBIDDEN");
    }

    if (payload.type === BehaviourType.COUNSELLOR_NOTE && !canViewCounsellorNotes(user.role)) {
      throw new AppError(403, "Counsellor notes are restricted to Principal/Admin roles", "FORBIDDEN");
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: user.schoolId
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
        isRestricted: payload.type === BehaviourType.COUNSELLOR_NOTE ? true : Boolean(payload.isRestricted),
        actionTaken: payload.actionTaken
      },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }, { label: "createBehaviourRecord" });
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

export async function createStudent(schoolId: string, data: Record<string, unknown>) {
  const { feeStructureId, ...studentData } = data as { feeStructureId?: string } & Record<string, unknown>;
  
  if (!studentData.admissionNumber) {
    studentData.admissionNumber = await generateAdmissionNumber(schoolId);
  }

  const student = await prisma.student.create({ 
    data: { 
      ...studentData, 
      schoolId,
      joiningDate: studentData.joiningDate ? new Date(studentData.joiningDate as string) : new Date(),
      dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth as string) : null,
    } as never 
  });

  if (feeStructureId) {
    await assignFee(schoolId, student.id, feeStructureId);
  }

  return student;
}

export async function updateStudent(schoolId: string, id: string, data: Record<string, unknown>) {
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  return prisma.student.update({ where: { id }, data });
}

export async function deactivateStudent(schoolId: string, id: string) {
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  return prisma.student.update({ where: { id }, data: { isActive: false } });
}

export async function activateStudent(schoolId: string, id: string) {
  const existing = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Student");
  return prisma.student.update({ where: { id }, data: { isActive: true } });
}
