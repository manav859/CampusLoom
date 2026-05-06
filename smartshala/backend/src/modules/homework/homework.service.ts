import { HomeworkSubmissionStatus, Prisma, UserRole } from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

type HomeworkUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;
const defaultClassSubjects = ["English", "Hindi", "Mathematics", "Science", "Social Studies"];

type CreateHomeworkAssignmentInput = {
  classId: string;
  subjectId?: string;
  subject?: string;
  title: string;
  description?: string;
  assignedDate?: Date;
  dueDate: Date;
};

type UpdateHomeworkSubmissionInput = {
  studentId: string;
  status: HomeworkSubmissionStatus;
  marks?: number | null;
  teacherNote?: string | null;
  submittedAt?: Date | null;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function canManageHomework(user: HomeworkUser) {
  return user.role === UserRole.TEACHER || user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN;
}

function teacherOwnershipFilter(user: HomeworkUser) {
  return user.role === UserRole.TEACHER ? { assignedById: user.id } : {};
}

async function assertClassAccess(user: HomeworkUser, classId: string) {
  if (!canManageHomework(user)) {
    throw new AppError(403, "You do not have permission to manage homework", "FORBIDDEN");
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

async function subjectForAssignment(user: HomeworkUser, classId: string, subjectId?: string, subject?: string) {
  if (!subjectId) return { subjectId: null, subject: subject?.trim() || "General" };

  const subjectRecord = await prisma.subject.findFirst({
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
  if (!subjectRecord) throw notFound("Subject");
  return { subjectId: subjectRecord.id, subject: subjectRecord.name };
}

async function ensureClassSubjects(user: HomeworkUser, classId: string, teacherId?: string | null) {
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

function homeworkStatusFromCounts(input: { total: number; onTime: number; late: number; notSubmitted: number; dueDate: Date }) {
  if (input.total > 0 && input.notSubmitted === 0) return "COMPLETED";
  if (input.dueDate.getTime() < Date.now()) return "OVERDUE";
  return "OPEN";
}

function mapAssignment(assignment: {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  subject: string | null;
  assignedDate: Date;
  dueDate: Date;
  subjectRef: { id: string; name: string } | null;
  class: { id: string; name: string; section: string };
  submissions: { status: HomeworkSubmissionStatus }[];
  _count: { submissions: number };
}, classStudentCount: number) {
  const onTime = assignment.submissions.filter((submission) => submission.status === HomeworkSubmissionStatus.ON_TIME).length;
  const late = assignment.submissions.filter((submission) => submission.status === HomeworkSubmissionStatus.LATE).length;
  const explicitlyNotSubmitted = assignment.submissions.filter(
    (submission) => submission.status === HomeworkSubmissionStatus.NOT_SUBMITTED || submission.status === HomeworkSubmissionStatus.MISSING
  ).length;
  const notSubmitted = Math.max(0, classStudentCount - onTime - late) || explicitlyNotSubmitted;

  return {
    id: assignment.id,
    classId: assignment.classId,
    className: `${assignment.class.name}-${assignment.class.section}`,
    title: assignment.title,
    description: assignment.description,
    subject: assignment.subjectRef?.name ?? assignment.subject ?? "General",
    subjectId: assignment.subjectRef?.id ?? null,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
    status: homeworkStatusFromCounts({ total: classStudentCount, onTime, late, notSubmitted, dueDate: assignment.dueDate }),
    submittedCount: onTime,
    lateCount: late,
    notSubmittedCount: notSubmitted,
    totalStudents: classStudentCount
  };
}

function normalizeSubmittedAt(input: UpdateHomeworkSubmissionInput) {
  if (input.status === HomeworkSubmissionStatus.ON_TIME || input.status === HomeworkSubmissionStatus.LATE) {
    return input.submittedAt ?? new Date();
  }
  return null;
}

function mapSubmission(submission: {
  id: string;
  studentId: string;
  status: HomeworkSubmissionStatus;
  marks: unknown;
  teacherNote: string | null;
  submittedAt: Date | null;
  student: { id: string; fullName: string; admissionNumber: string; rollNumber: number | null };
}) {
  return {
    id: submission.id,
    studentId: submission.studentId,
    studentName: submission.student.fullName,
    admissionNumber: submission.student.admissionNumber,
    rollNumber: submission.student.rollNumber,
    status: submission.status,
    marks: submission.marks === null || submission.marks === undefined ? null : Number(submission.marks),
    teacherNote: submission.teacherNote,
    submittedAt: submission.submittedAt
  };
}

export async function homeworkContext(user: Express.UserContext) {
  return withRetry(async () => {
    if (!canManageHomework(user)) {
      throw new AppError(403, "You do not have permission to manage homework", "FORBIDDEN");
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
        _count: { select: { students: true } }
      },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    });

    return {
      classes: hydratedClasses.map((classRecord) => ({
        id: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        studentCount: classRecord._count.students,
        subjects: classRecord.subjects
      }))
    };
  }, { label: "homeworkContext" });
}

export async function listAssignments(user: Express.UserContext, query: { classId?: string }) {
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
    const classStudentCounts = new Map(classes.map((classRecord) => [classRecord.id, classRecord._count.students]));
    const classIds = classes.map((classRecord) => classRecord.id);

    if (classIds.length === 0) return [];

    const assignments = await prisma.homeworkAssignment.findMany({
      where: {
        schoolId: user.schoolId,
        classId: { in: classIds },
        ...teacherOwnershipFilter(user)
      },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subjectRef: { select: { id: true, name: true } },
        submissions: { select: { status: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }]
    });

    return assignments.map((assignment) => mapAssignment(assignment, classStudentCounts.get(assignment.classId) ?? assignment._count.submissions));
  }, { label: "listHomeworkAssignments" });
}

export async function createAssignment(user: Express.UserContext, input: CreateHomeworkAssignmentInput) {
  return withRetry(async () => {
    await assertClassAccess(user, input.classId);
    const subject = await subjectForAssignment(user, input.classId, input.subjectId, input.subject);
    const assignedDate = startOfDay(input.assignedDate ?? new Date());
    const dueDate = startOfDay(input.dueDate);

    if (dueDate.getTime() < assignedDate.getTime()) {
      throw new AppError(400, "Due date must be on or after assigned date", "INVALID_HOMEWORK_DUE_DATE");
    }

    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, classId: input.classId, isActive: true },
      select: { id: true }
    });

    const created = await prisma.homeworkAssignment.create({
      data: {
        schoolId: user.schoolId,
        classId: input.classId,
        subjectId: subject.subjectId,
        subject: subject.subject,
        title: input.title,
        description: input.description,
        assignedById: user.id,
        assignedDate,
        dueDate
      }
    });

    if (students.length > 0) {
      await prisma.homeworkSubmission.createMany({
        data: students.map((student) => ({
          schoolId: user.schoolId,
          assignmentId: created.id,
          studentId: student.id,
          status: HomeworkSubmissionStatus.NOT_SUBMITTED
        })),
        skipDuplicates: true
      });
    }

    const assignment = await prisma.homeworkAssignment.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subjectRef: { select: { id: true, name: true } },
        submissions: { select: { status: true } },
        _count: { select: { submissions: true } }
      }
    });

    return mapAssignment(assignment, students.length);
  }, { label: "createHomeworkAssignment" });
}

export async function getAssignment(user: Express.UserContext, assignmentId: string) {
  return withRetry(async () => {
    if (!canManageHomework(user)) {
      throw new AppError(403, "You do not have permission to manage homework", "FORBIDDEN");
    }

    const assignment = await prisma.homeworkAssignment.findFirst({
      where: {
        id: assignmentId,
        schoolId: user.schoolId,
        ...teacherOwnershipFilter(user)
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
        submissions: {
          include: { student: { select: { id: true, fullName: true, admissionNumber: true, rollNumber: true } } },
          orderBy: { student: { rollNumber: "asc" } }
        },
        _count: { select: { submissions: true } }
      }
    });
    if (!assignment) throw notFound("Homework assignment");

    const submissionsByStudent = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));
    const missingStudents = assignment.class.students.filter((student) => !submissionsByStudent.has(student.id));

    if (missingStudents.length > 0) {
      await prisma.homeworkSubmission.createMany({
        data: missingStudents.map((student) => ({
          schoolId: user.schoolId,
          assignmentId: assignment.id,
          studentId: student.id,
          status: HomeworkSubmissionStatus.NOT_SUBMITTED
        })),
        skipDuplicates: true
      });
    }

    const complete = missingStudents.length > 0
      ? await prisma.homeworkAssignment.findUniqueOrThrow({
          where: { id: assignment.id },
          include: {
            class: { select: { id: true, name: true, section: true, students: { where: { isActive: true }, select: { id: true }, orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }] } } },
            subjectRef: { select: { id: true, name: true } },
            submissions: {
              include: { student: { select: { id: true, fullName: true, admissionNumber: true, rollNumber: true } } },
              orderBy: { student: { rollNumber: "asc" } }
            },
            _count: { select: { submissions: true } }
          }
        })
      : assignment;

    return {
      ...mapAssignment(complete, complete.class.students.length),
      submissions: complete.submissions.map(mapSubmission)
    };
  }, { label: "getHomeworkAssignment" });
}

export async function updateSubmission(user: Express.UserContext, assignmentId: string, input: UpdateHomeworkSubmissionInput) {
  return withRetry(async () => {
    const assignment = await prisma.homeworkAssignment.findFirst({
      where: {
        id: assignmentId,
        schoolId: user.schoolId,
        ...teacherOwnershipFilter(user)
      },
      select: { id: true, classId: true }
    });
    if (!assignment) throw notFound("Homework assignment");

    const student = await prisma.student.findFirst({
      where: { id: input.studentId, schoolId: user.schoolId, classId: assignment.classId, isActive: true },
      select: { id: true, fullName: true, admissionNumber: true, rollNumber: true }
    });
    if (!student) {
      throw new AppError(400, "Student is not part of this homework class", "INVALID_HOMEWORK_STUDENT");
    }

    const submittedAt = normalizeSubmittedAt(input);
    if (input.marks !== null && input.marks !== undefined && input.marks > 20) {
      throw new AppError(400, "Homework marks cannot exceed 20", "HOMEWORK_MARKS_LIMIT_EXCEEDED");
    }

    const row = await prisma.homeworkSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      update: {
        status: input.status,
        marks: input.marks === null || input.marks === undefined ? null : new Prisma.Decimal(input.marks),
        teacherNote: input.teacherNote ?? null,
        submittedAt
      },
      create: {
        schoolId: user.schoolId,
        assignmentId,
        studentId: student.id,
        status: input.status,
        marks: input.marks === null || input.marks === undefined ? null : new Prisma.Decimal(input.marks),
        teacherNote: input.teacherNote ?? null,
        submittedAt
      },
      include: { student: { select: { id: true, fullName: true, admissionNumber: true, rollNumber: true } } }
    });

    return mapSubmission(row);
  }, { label: "updateHomeworkSubmission" });
}
