import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { notFound } from "../../core/errors.js";

export async function listStudents(user: Express.UserContext, query: unknown) {
  const pagination = getPagination(query);
  const teacherClassIds =
    user.role === UserRole.TEACHER
      ? (await prisma.class.findMany({ where: { schoolId: user.schoolId, classTeacherId: user.id }, select: { id: true } })).map(
          (item) => item.id
        )
      : undefined;

  const where = {
    schoolId: user.schoolId,
    ...(teacherClassIds ? { classId: { in: teacherClassIds } } : {}),
    ...(pagination.search
      ? {
          OR: [
            { fullName: { contains: pagination.search, mode: "insensitive" as const } },
            { admissionNumber: { contains: pagination.search, mode: "insensitive" as const } },
            { parentPhone: { contains: pagination.search } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      include: { class: { select: { id: true, name: true, section: true, academicYear: true } } },
      orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { fullName: "asc" }]
    }),
    prisma.student.count({ where })
  ]);

  return { items, total, page: pagination.page, limit: pagination.limit };
}

export async function getStudent(user: Express.UserContext, id: string) {
  const student = await prisma.student.findFirst({
    where: {
      id,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
    },
    include: {
      class: true,
      feeAssignments: { include: { feeStructure: true, payments: { include: { receipt: true } } } },
      attendanceRecords: {
        take: 60,
        orderBy: { createdAt: "desc" },
        include: { session: { select: { date: true, classId: true } } }
      }
    }
  });
  if (!student) throw notFound("Student");
  return student;
}

export async function createStudent(schoolId: string, data: Record<string, unknown>) {
  return prisma.student.create({ data: { ...data, schoolId } as never });
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

