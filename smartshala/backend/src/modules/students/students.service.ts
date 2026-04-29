import { UserRole } from "@prisma/client";
import { prisma, withRetry } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { notFound } from "../../core/errors.js";
import { assignFee } from "../fees/fees.service.js";

export async function listStudents(user: Express.UserContext, query: unknown) {
  return withRetry(async () => {
    const pagination = getPagination(query);
    const teacherClassIds =
      user.role === UserRole.TEACHER
        ? (await prisma.class.findMany({ where: { schoolId: user.schoolId, classTeacherId: user.id }, select: { id: true } })).map(
            (item) => item.id
          )
        : undefined;

    const { classId } = (query || {}) as { classId?: string };

    const where = {
      schoolId: user.schoolId,
      ...(classId ? { classId } : {}),
      ...(teacherClassIds ? { classId: { in: teacherClassIds } } : {}),
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
          feeAssignments: { select: { id: true, pendingAmount: true, status: true } }
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
  }, { label: "getStudent" });
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

