import { Prisma, UserRole } from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

type MarksUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;

type CreateExamWithMarksInput = {
  classId: string;
  subjectId: string;
  name: string;
  maxMarks: number;
  date: Date;
  results: { studentId: string; marks: number; teacherNote?: string }[];
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
      ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
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
      OR: [{ classId }, { classId: null }]
    },
    select: { id: true, name: true }
  });
  if (!subject) throw notFound("Subject");
  return subject;
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

export async function marksContext(user: Express.UserContext) {
  return withRetry(async () => {
    if (!canManageMarks(user)) {
      throw new AppError(403, "You do not have permission to manage marks", "FORBIDDEN");
    }

    const classes = await prisma.class.findMany({
      where: {
        schoolId: user.schoolId,
        ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
      },
      include: {
        subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        students: {
          where: { isActive: true },
          select: { id: true, fullName: true, rollNumber: true },
          orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
        }
      },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    });

    return {
      classes: classes.map((classRecord) => ({
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
        ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
      },
      select: { id: true, _count: { select: { students: true } } }
    });
    const classIds = classes.map((classRecord) => classRecord.id);
    const classCounts = new Map(classes.map((classRecord) => [classRecord.id, classRecord._count.students]));
    if (classIds.length === 0) return [];

    const exams = await prisma.exam.findMany({
      where: { schoolId: user.schoolId, classId: { in: classIds } },
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
      select: { id: true }
    });
    const allowedStudentIds = new Set(students.map((student) => student.id));
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

      for (const result of input.results) {
        const percent = percentage(result.marks, input.maxMarks);
        await tx.examResult.upsert({
          where: { studentId_examId: { studentId: result.studentId, examId: createdExam.id } },
          update: {
            marksObtained: new Prisma.Decimal(result.marks),
            maxMarks,
            percentage: new Prisma.Decimal(percent),
            grade: gradeForPercentage(percent),
            examDate: input.date
          },
          create: {
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
          }
        });
      }

      return tx.exam.findUniqueOrThrow({
        where: { id: createdExam.id },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subjectRef: { select: { id: true, name: true } },
          results: { select: { studentId: true, marksObtained: true, percentage: true } }
        }
      });
    });

    return mapExam(exam, students.length);
  }, { label: "createExamWithMarks" });
}
