import { NotificationKind, Prisma, UserRole } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { prisma, withRetry } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { buildLowMarksMessage } from "../whatsapp/templates.js";
import { sendMessage as sendWhatsAppMessage } from "../whatsapp/whatsapp.service.js";

type MarksUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;
const defaultClassSubjects = ["English", "Hindi", "Mathematics", "Science", "Social Studies"];

type CreateExamWithMarksInput = {
  classId: string;
  subjectId: string;
  name: string;
  maxMarks: number;
  date: Date;
  results: { studentId: string; marks: number; teacherNote?: string }[];
};

type UpdateExamResultInput = {
  studentId: string;
  marks: number;
};

type LowMarksAlertInput = {
  schoolId: string;
  studentId: string;
  studentName: string;
  parentPhone: string | null;
  examName: string;
  subject: string;
  marks: number;
  maxMarks: number;
  percentage: number;
  examDate: Date;
};

function canManageMarks(user: MarksUser) {
  return user.role === UserRole.TEACHER || user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN;
}

async function assertClassAccess(user: MarksUser, classId: string) {
  if (!canManageMarks(user)) {
    throw new AppError(403, "You do not have permission to manage marks", "FORBIDDEN");
  }

  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER
        ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
        : {})
    }
  });
  if (!classRecord) throw notFound("Class");
  return classRecord;
}

async function assertSubjectAccess(user: MarksUser, classId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      schoolId: user.schoolId,
      AND: [
        { OR: [{ classId }, { classId: null }] },
        ...(user.role === UserRole.TEACHER ? [{ OR: [{ teacherId: user.id }, { class: { classTeacherId: user.id } }] }] : [])
      ]
    },
    select: { id: true, name: true }
  });
  if (!subject) throw notFound("Subject");
  return subject;
}

async function ensureClassSubjects(user: MarksUser, classId: string, teacherId?: string | null) {
  const count = await prisma.subject.count({ where: { schoolId: user.schoolId, classId } });
  if (count > 0) {
    if (teacherId) {
      await prisma.subject.updateMany({
        where: { schoolId: user.schoolId, classId, OR: [{ teacherId: null }, { teacherId: { not: teacherId } }] },
        data: { teacherId }
      });
    }
    return;
  }

  await prisma.subject.createMany({
    data: defaultClassSubjects.map((name) => ({
      schoolId: user.schoolId,
      classId,
      teacherId: teacherId ?? null,
      name
    })),
    skipDuplicates: true
  });
}

function percentage(marks: number, maxMarks: number) {
  if (maxMarks <= 0) return 0;
  return Math.round((marks / maxMarks) * 10000) / 100;
}

function gradeForPercentage(value: number) {
  if (value >= 90) return "A+";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "D";
}

function examStatus(examDate: Date) {
  return examDate.getTime() > Date.now() ? "SCHEDULED" : "MARKS_ENTERED";
}

function mapExam(exam: {
  id: string;
  classId: string | null;
  name: string;
  maxMarks: unknown;
  examDate: Date;
  subjectRef: { id: string; name: string } | null;
  class: { id: string; name: string; section: string } | null;
  results: { studentId: string; marksObtained: unknown; percentage: unknown }[];
}, classStudentCount: number) {
  const percentages = exam.results.map((result) => Number(result.percentage ?? percentage(Number(result.marksObtained), Number(exam.maxMarks ?? 0))));
  const classAverage = percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : 0;

  return {
    id: exam.id,
    classId: exam.classId,
    className: exam.class ? `${exam.class.name}-${exam.class.section}` : "Class",
    subjectId: exam.subjectRef?.id ?? null,
    subject: exam.subjectRef?.name ?? "General",
    name: exam.name,
    maxMarks: Number(exam.maxMarks ?? 0),
    date: exam.examDate,
    status: examStatus(exam.examDate),
    enteredCount: exam.results.length,
    pendingCount: Math.max(0, classStudentCount - exam.results.length),
    classAverage
  };
}

function teacherExamWhere(user: MarksUser) {
  return user.role === UserRole.TEACHER
    ? {
        OR: [
          { class: { classTeacherId: user.id } },
          { subjectRef: { teacherId: user.id } }
        ]
      }
    : {};
}

function mapExamResult(result: {
  id: string;
  marksObtained: unknown;
  percentage: unknown;
  grade: string | null;
}, maxMarks: number) {
  const marks = Number(result.marksObtained ?? 0);
  return {
    resultId: result.id,
    marks,
    percentage: Number(result.percentage ?? percentage(marks, maxMarks)),
    grade: result.grade ?? gradeForPercentage(percentage(marks, maxMarks))
  };
}

function queueLowMarksAlerts(alerts: LowMarksAlertInput[]) {
  const seen = new Set<string>();
  const pendingAlerts = alerts.filter((alert) => {
    const phone = alert.parentPhone?.trim();
    const key = `${alert.studentId}:${alert.examName}:${alert.subject}`;
    if (!phone || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (pendingAlerts.length === 0) return;

  setImmediate(() => {
    void sendLowMarksAlerts(pendingAlerts);
  });
}

async function sendLowMarksAlerts(alerts: LowMarksAlertInput[]) {
  for (const alert of alerts) {
    const phone = alert.parentPhone?.trim();
    if (!phone) continue;

    const message = buildLowMarksMessage(
      alert.studentName,
      alert.examName,
      alert.subject,
      alert.marks,
      alert.maxMarks,
      alert.percentage,
      alert.examDate
    );

    try {
      await sendWhatsAppMessage(phone, message, {
        schoolId: alert.schoolId,
        studentId: alert.studentId,
        kind: NotificationKind.SCHOOL_ALERT
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          schoolId: alert.schoolId,
          studentId: alert.studentId
        },
        "Failed to send low marks WhatsApp notification"
      );
    }
  }
}

export async function marksContext(user: Express.UserContext) {
  return withRetry(async () => {
    if (!canManageMarks(user)) {
      throw new AppError(403, "You do not have permission to manage marks", "FORBIDDEN");
    }

    const classes = await prisma.class.findMany({
      where: {
        schoolId: user.schoolId,
        ...(user.role === UserRole.TEACHER
          ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
          : {})
      },
      select: {
        id: true,
        classTeacherId: true,
        subjects: { select: { teacherId: true } }
      }
    });
    await Promise.all(
      classes
        .filter(
          (classRecord) =>
            classRecord.subjects.length === 0 ||
            Boolean(classRecord.classTeacherId && classRecord.subjects.some((subject) => subject.teacherId !== classRecord.classTeacherId))
        )
        .map((classRecord) => ensureClassSubjects(user, classRecord.id, classRecord.classTeacherId))
    );

    const hydratedClasses = await prisma.class.findMany({
      where: {
        schoolId: user.schoolId,
        ...(user.role === UserRole.TEACHER
          ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
          : {})
      },
      include: {
        subjects: {
          where: user.role === UserRole.TEACHER ? { OR: [{ teacherId: user.id }, { class: { classTeacherId: user.id } }] } : {},
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        },
        students: {
          where: { isActive: true },
          select: { id: true, fullName: true, rollNumber: true },
          orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
        }
      },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    });

    return {
      classes: hydratedClasses.map((classRecord) => ({
        id: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        subjects: classRecord.subjects,
        students: classRecord.students
      }))
    };
  }, { label: "marksContext" });
}

export async function listExams(user: Express.UserContext, query: { classId?: string }) {
  return withRetry(async () => {
    if (query.classId) await assertClassAccess(user, query.classId);

    const classes = await prisma.class.findMany({
      where: {
        schoolId: user.schoolId,
        ...(query.classId ? { id: query.classId } : {}),
        ...(user.role === UserRole.TEACHER
          ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
          : {})
      },
      select: { id: true, _count: { select: { students: true } } }
    });
    const classIds = classes.map((classRecord) => classRecord.id);
    const classCounts = new Map(classes.map((classRecord) => [classRecord.id, classRecord._count.students]));
    if (classIds.length === 0) return [];

    const exams = await prisma.exam.findMany({
      where: {
        schoolId: user.schoolId,
        classId: { in: classIds },
        ...teacherExamWhere(user)
      },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subjectRef: { select: { id: true, name: true } },
        results: { select: { studentId: true, marksObtained: true, percentage: true } }
      },
      orderBy: [{ examDate: "desc" }, { createdAt: "desc" }]
    });

    return exams.map((exam) => mapExam(exam, classCounts.get(exam.classId ?? "") ?? exam.results.length));
  }, { label: "listMarksExams" });
}

export async function createExamWithMarks(user: Express.UserContext, input: CreateExamWithMarksInput) {
  return withRetry(async () => {
    await assertClassAccess(user, input.classId);
    const subject = await assertSubjectAccess(user, input.classId, input.subjectId);
    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, classId: input.classId, isActive: true },
      select: { id: true, fullName: true, parentPhone: true }
    });
    const allowedStudentIds = new Set(students.map((student) => student.id));
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const invalid = input.results.filter((result) => !allowedStudentIds.has(result.studentId));
    if (invalid.length > 0) {
      throw new AppError(400, "Marks include students outside the selected class", "INVALID_MARKS_STUDENTS", {
        studentIds: invalid.map((item) => item.studentId)
      });
    }

    const maxMarks = new Prisma.Decimal(input.maxMarks);
    const exam = await prisma.$transaction(async (tx) => {
      const createdExam = await tx.exam.create({
        data: {
          schoolId: user.schoolId,
          classId: input.classId,
          subjectId: subject.id,
          name: input.name,
          maxMarks,
          examDate: input.date
        }
      });

      await tx.examResult.createMany({
        data: input.results.map((result) => {
          const percent = percentage(result.marks, input.maxMarks);
          return {
            schoolId: user.schoolId,
            studentId: result.studentId,
            examId: createdExam.id,
            subjectId: subject.id,
            subject: subject.name,
            assessmentName: input.name,
            marksObtained: new Prisma.Decimal(result.marks),
            maxMarks,
            percentage: new Prisma.Decimal(percent),
            grade: gradeForPercentage(percent),
            examDate: input.date
          };
        })
      });

      return tx.exam.findUniqueOrThrow({
        where: { id: createdExam.id },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subjectRef: { select: { id: true, name: true } },
          results: { select: { studentId: true, marksObtained: true, percentage: true } }
        }
      });
    }, { timeout: 15000 });

    queueLowMarksAlerts(
      input.results.flatMap((result) => {
        const percent = percentage(result.marks, input.maxMarks);
        const student = studentsById.get(result.studentId);
        if (!student || percent >= 40) return [];

        return [{
          schoolId: user.schoolId,
          studentId: student.id,
          studentName: student.fullName,
          parentPhone: student.parentPhone,
          examName: input.name,
          subject: subject.name,
          marks: result.marks,
          maxMarks: input.maxMarks,
          percentage: percent,
          examDate: input.date
        }];
      })
    );

    return mapExam(exam, students.length);
  }, { label: "createExamWithMarks" });
}

export async function getExam(user: Express.UserContext, examId: string) {
  return withRetry(async () => {
    if (!canManageMarks(user)) {
      throw new AppError(403, "You do not have permission to manage marks", "FORBIDDEN");
    }

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        schoolId: user.schoolId,
        ...teacherExamWhere(user)
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            students: {
              where: { isActive: true },
              select: { id: true, fullName: true, admissionNumber: true, rollNumber: true },
              orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
            }
          }
        },
        subjectRef: { select: { id: true, name: true } },
        results: {
          include: {
            student: { select: { id: true, fullName: true, admissionNumber: true, rollNumber: true } }
          },
          orderBy: { student: { rollNumber: "asc" } }
        }
      }
    });
    if (!exam || !exam.classId || !exam.class) throw notFound("Exam");

    const maxMarks = Number(exam.maxMarks ?? 0);
    const resultsByStudent = new Map(exam.results.map((result) => [result.studentId, result]));
    const students = exam.class.students.map((student) => {
      const result = resultsByStudent.get(student.id);
      return {
        studentId: student.id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        result: result ? mapExamResult(result, maxMarks) : null
      };
    });

    return {
      ...mapExam(
        {
          id: exam.id,
          classId: exam.classId,
          name: exam.name,
          maxMarks: exam.maxMarks,
          examDate: exam.examDate,
          subjectRef: exam.subjectRef,
          class: exam.class,
          results: exam.results
        },
        exam.class.students.length
      ),
      students
    };
  }, { label: "getMarksExam" });
}

export async function updateExamResult(user: Express.UserContext, examId: string, input: UpdateExamResultInput) {
  return withRetry(async () => {
    if (!canManageMarks(user)) {
      throw new AppError(403, "You do not have permission to manage marks", "FORBIDDEN");
    }

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        schoolId: user.schoolId,
        ...teacherExamWhere(user)
      },
      include: {
        class: { select: { id: true } },
        subjectRef: { select: { id: true, name: true } }
      }
    });
    if (!exam || !exam.classId || !exam.class) throw notFound("Exam");

    const maxMarks = Number(exam.maxMarks ?? 0);
    if (input.marks > maxMarks) {
      throw new AppError(400, "Marks cannot exceed max marks", "INVALID_MARKS");
    }

    const student = await prisma.student.findFirst({
      where: { id: input.studentId, schoolId: user.schoolId, classId: exam.classId, isActive: true },
      select: { id: true, fullName: true, admissionNumber: true, rollNumber: true, parentPhone: true }
    });
    if (!student) {
      throw new AppError(400, "Student is not part of this exam class", "INVALID_MARKS_STUDENT");
    }

    const existingResult = await prisma.examResult.findUnique({
      where: { studentId_examId: { studentId: student.id, examId } },
      select: { marksObtained: true, percentage: true }
    });
    const existingPercentage = existingResult
      ? Number(existingResult.percentage ?? percentage(Number(existingResult.marksObtained), maxMarks))
      : null;
    const percent = percentage(input.marks, maxMarks);
    const result = await prisma.examResult.upsert({
      where: { studentId_examId: { studentId: student.id, examId } },
      update: {
        marksObtained: new Prisma.Decimal(input.marks),
        maxMarks: new Prisma.Decimal(maxMarks),
        percentage: new Prisma.Decimal(percent),
        grade: gradeForPercentage(percent),
        examDate: exam.examDate,
        assessmentName: exam.name,
        subjectId: exam.subjectId,
        subject: exam.subjectRef?.name ?? "General"
      },
      create: {
        schoolId: user.schoolId,
        studentId: student.id,
        examId,
        subjectId: exam.subjectId,
        subject: exam.subjectRef?.name ?? "General",
        assessmentName: exam.name,
        marksObtained: new Prisma.Decimal(input.marks),
        maxMarks: new Prisma.Decimal(maxMarks),
        percentage: new Prisma.Decimal(percent),
        grade: gradeForPercentage(percent),
        examDate: exam.examDate
      }
    });

    if (percent < 40 && (existingPercentage === null || existingPercentage >= 40)) {
      queueLowMarksAlerts([
        {
          schoolId: user.schoolId,
          studentId: student.id,
          studentName: student.fullName,
          parentPhone: student.parentPhone,
          examName: exam.name,
          subject: exam.subjectRef?.name ?? "General",
          marks: input.marks,
          maxMarks,
          percentage: percent,
          examDate: exam.examDate
        }
      ]);
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      result: mapExamResult(result, maxMarks)
    };
  }, { label: "updateMarksExamResult" });
}
