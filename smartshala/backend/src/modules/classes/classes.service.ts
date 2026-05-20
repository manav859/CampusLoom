import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const defaultClassSubjects = ["English", "Hindi", "Mathematics", "Science", "Social Studies"];

function sortClassRecords<T extends { name: string; section: string }>(classes: T[]) {
  return [...classes].sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });
}

async function ensureClassSubjects(schoolId: string, classId: string, teacherId?: string | null) {
  const existing = await prisma.subject.findMany({
    where: { schoolId, classId },
    select: { id: true, teacherId: true }
  });

  if (existing.length === 0) {
    await prisma.subject.createMany({
      data: defaultClassSubjects.map((name) => ({
        schoolId,
        classId,
        teacherId: teacherId ?? null,
        name
      })),
      skipDuplicates: true
    });
    return;
  }

  if (teacherId && existing.some((subject) => subject.teacherId !== teacherId)) {
    await prisma.subject.updateMany({
      where: { schoolId, classId, OR: [{ teacherId: null }, { teacherId: { not: teacherId } }] },
      data: { teacherId }
    });
  }
}

async function replaceClassSubjects(schoolId: string, classId: string, subjects: string[], teacherId?: string | null) {
  const uniqueSubjects = Array.from(new Set(subjects.map((subject) => subject.trim()).filter(Boolean)));
  await prisma.subject.deleteMany({ where: { schoolId, classId } });
  await prisma.subject.createMany({
    data: uniqueSubjects.map((name) => ({
      schoolId,
      classId,
      teacherId: teacherId ?? null,
      name
    })),
    skipDuplicates: true
  });
}

export async function listClasses(user: Express.UserContext, options: { scope?: "classTeacher" } = {}) {
  const parentClassIds =
    user.role === UserRole.PARENT
      ? (
          await prisma.student.findMany({
            where: {
              schoolId: user.schoolId,
              isActive: true,
              OR: [{ parentPhone: user.phone ?? "" }, { alternatePhone: user.phone ?? "" }]
            },
            select: { classId: true }
          })
        ).map((student) => student.classId)
      : undefined;

  const classes = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      ...((user.role as string) === UserRole.TEACHER
        ? options.scope === "classTeacher"
          ? { classTeacherId: user.id }
          : { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
        : {}),
      ...(parentClassIds ? { id: { in: parentClassIds } } : {})
    },
    include: {
      classTeacher: { select: { id: true, fullName: true, phone: true } },
      subjects: { select: { id: true, name: true, teacherId: true }, orderBy: { name: "asc" } },
      _count: { select: { students: true } }
    }
  });

  const classesNeedingSubjects = classes.filter(
    (classRecord) =>
      classRecord.subjects.length === 0 ||
      Boolean(classRecord.classTeacherId && classRecord.subjects.some((subject) => subject.teacherId !== classRecord.classTeacherId))
  );

  if (classesNeedingSubjects.length === 0) {
    return sortClassRecords(classes);
  }

  await Promise.all(classesNeedingSubjects.map((classRecord) => ensureClassSubjects(user.schoolId, classRecord.id, classRecord.classTeacherId)));

  const hydratedClasses = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      ...((user.role as string) === UserRole.TEACHER
        ? options.scope === "classTeacher"
          ? { classTeacherId: user.id }
          : { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
        : {}),
      ...(parentClassIds ? { id: { in: parentClassIds } } : {})
    },
    include: {
      classTeacher: { select: { id: true, fullName: true, phone: true } },
      subjects: { select: { id: true, name: true, teacherId: true }, orderBy: { name: "asc" } },
      _count: { select: { students: true } }
    }
  });

  return sortClassRecords(hydratedClasses);
}

export async function createClass(
  schoolId: string,
  data: {
    name: string;
    section: string;
    academicYear: string;
    classTeacherId: string;
    maximumStrength?: number | null;
    stream?: string | null;
    mediumOfInstruction: string;
    subjects: string[];
  }
) {
  if (data.classTeacherId) {
    const teacher = await prisma.user.findFirst({ where: { id: data.classTeacherId, schoolId, role: UserRole.TEACHER } });
    if (!teacher) throw new AppError(400, "Class teacher must be an active teacher in this school", "INVALID_TEACHER");
  }
  const { subjects, ...classData } = data;
  const created = await prisma.class.create({ data: { schoolId, ...classData } });
  await replaceClassSubjects(schoolId, created.id, subjects, created.classTeacherId);
  return created;
}

export async function updateClass(schoolId: string, id: string, data: Record<string, unknown>) {
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Class");
  const { subjects, ...classData } = data as { subjects?: string[] } & Record<string, unknown>;
  const updated = await prisma.class.update({ where: { id }, data: classData });
  if (subjects) await replaceClassSubjects(schoolId, updated.id, subjects, updated.classTeacherId);
  if ("classTeacherId" in data) await ensureClassSubjects(schoolId, updated.id, updated.classTeacherId);
  return updated;
}

export async function getClass(user: Express.UserContext, id: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER
        ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
        : {})
    },
    include: {
      classTeacher: { select: { id: true, fullName: true, phone: true, email: true } },
      subjects: { select: { id: true, name: true, teacherId: true, teacher: { select: { id: true, fullName: true } } }, orderBy: { name: "asc" } },
      _count: { select: { students: true } }
    }
  });
  if (!classRecord) throw notFound("Class");
  await ensureClassSubjects(user.schoolId, classRecord.id, classRecord.classTeacherId);
  if (classRecord.subjects.length === 0 || classRecord.subjects.some((subject) => subject.teacherId !== classRecord.classTeacherId)) {
    return getClass(user, id);
  }
  return classRecord;
}

export async function getClassStudents(user: Express.UserContext, classId: string) {
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

  return prisma.student.findMany({
    where: { schoolId: user.schoolId, classId, isActive: true },
    orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
  });
}

export async function getClassStats(user: Express.UserContext, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER
        ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
        : {})
    },
    select: { id: true }
  });
  if (!classRecord) throw notFound("Class");

  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const [attendance, marks, fees] = await Promise.all([
    prisma.attendanceRecord.aggregate({
      where: {
        schoolId: user.schoolId,
        session: { classId, date: { gte: since } }
      },
      _count: { _all: true },
      _sum: { attendanceValue: true }
    }),
    prisma.examResult.aggregate({
      where: {
        schoolId: user.schoolId,
        percentage: { not: null },
        student: { classId, isActive: true }
      },
      _avg: { percentage: true }
    }),
    prisma.studentFeeAssignment.aggregate({
      where: {
        schoolId: user.schoolId,
        student: { classId, isActive: true }
      },
      _sum: { totalAmount: true, paidAmount: true }
    })
  ]);

  const attendanceCount = attendance._count._all;
  const attended = Number(attendance._sum.attendanceValue ?? 0);
  const totalFees = Number(fees._sum.totalAmount ?? 0);
  const paidFees = Number(fees._sum.paidAmount ?? 0);

  return {
    attendancePercent: attendanceCount > 0 ? Math.round((attended / attendanceCount) * 100) : null,
    marksAveragePercent: marks._avg.percentage === null ? null : Math.round(Number(marks._avg.percentage)),
    feeCollectionPercent: totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : null,
    attendanceWindowDays: 30
  };
}

export async function deleteClass(schoolId: string, id: string) {
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Class");
  
  // Note: If there are students in this class, deleting the class might fail due to FK constraints
  // or it might cascade depending on the Prisma schema.
  return prisma.class.delete({ where: { id } });
}
