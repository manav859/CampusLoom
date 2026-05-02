import { HomeworkSubmissionStatus, UserRole } from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

type HomeworkUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;

type CreateHomeworkAssignmentInput = {
  classId: string;
  subjectId?: string;
  subject?: string;
  title: string;
  description?: string;
  assignedDate?: Date;
  dueDate: Date;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function canManageHomework(user: HomeworkUser) {
  return user.role === UserRole.TEACHER || user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN;
}

async function assertClassAccess(user: HomeworkUser, classId: string) {
  if (!canManageHomework(user)) {
    throw new AppError(403, "You do not have permission to manage homework", "FORBIDDEN");
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

async function subjectForAssignment(user: HomeworkUser, classId: string, subjectId?: string, subject?: string) {
  if (!subjectId) return { subjectId: null, subject: subject?.trim() || "General" };

  const subjectRecord = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      schoolId: user.schoolId,
      OR: [{ classId }, { classId: null }]
    },
    select: { id: true, name: true }
  });
  if (!subjectRecord) throw notFound("Subject");
  return { subjectId: subjectRecord.id, subject: subjectRecord.name };
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

export async function homeworkContext(user: Express.UserContext) {
  return withRetry(async () => {
    if (!canManageHomework(user)) {
      throw new AppError(403, "You do not have permission to manage homework", "FORBIDDEN");
    }

    const classes = await prisma.class.findMany({
      where: {
        schoolId: user.schoolId,
        ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
      },
      include: {
        subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        _count: { select: { students: true } }
      },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    });

    return {
      classes: classes.map((classRecord) => ({
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
        ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
      },
      select: { id: true, _count: { select: { students: true } } }
    });
    const classStudentCounts = new Map(classes.map((classRecord) => [classRecord.id, classRecord._count.students]));
    const classIds = classes.map((classRecord) => classRecord.id);

    if (classIds.length === 0) return [];

    const assignments = await prisma.homeworkAssignment.findMany({
      where: { schoolId: user.schoolId, classId: { in: classIds } },
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

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.homeworkAssignment.create({
        data: {
          schoolId: user.schoolId,
          classId: input.classId,
          subjectId: subject.subjectId,
          subject: subject.subject,
          title: input.title,
          description: input.description,
          assignedDate,
          dueDate
        }
      });

      if (students.length > 0) {
        await tx.homeworkSubmission.createMany({
          data: students.map((student) => ({
            schoolId: user.schoolId,
            assignmentId: created.id,
            studentId: student.id,
            status: HomeworkSubmissionStatus.NOT_SUBMITTED
          })),
          skipDuplicates: true
        });
      }

      return tx.homeworkAssignment.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subjectRef: { select: { id: true, name: true } },
          submissions: { select: { status: true } },
          _count: { select: { submissions: true } }
        }
      });
    });

    return mapAssignment(assignment, students.length);
  }, { label: "createHomeworkAssignment" });
}
