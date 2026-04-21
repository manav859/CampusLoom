import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

export async function listClasses(user: Express.UserContext) {
  const classes = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      ...((user.role as string) === UserRole.TEACHER ? { classTeacherId: user.id } : {})
    },
    include: {
      classTeacher: { select: { id: true, fullName: true, phone: true } },
      _count: { select: { students: true } }
    }
  });

  return classes.sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });
}

export async function createClass(schoolId: string, data: { name: string; section: string; academicYear: string; classTeacherId?: string | null }) {
  if (data.classTeacherId) {
    const teacher = await prisma.user.findFirst({ where: { id: data.classTeacherId, schoolId, role: UserRole.TEACHER } });
    if (!teacher) throw new AppError(400, "Class teacher must be an active teacher in this school", "INVALID_TEACHER");
  }
  return prisma.class.create({ data: { schoolId, ...data } });
}

export async function updateClass(schoolId: string, id: string, data: Record<string, unknown>) {
  const existing = await prisma.class.findFirst({ where: { id, schoolId } });
  if (!existing) throw notFound("Class");
  return prisma.class.update({ where: { id }, data });
}

export async function getClassStudents(user: Express.UserContext, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
    }
  });
  if (!classRecord) throw notFound("Class");

  return prisma.student.findMany({
    where: { schoolId: user.schoolId, classId, isActive: true },
    orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
  });
}

