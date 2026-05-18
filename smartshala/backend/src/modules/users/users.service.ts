import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { AppError, notFound } from "../../core/errors.js";

type TeacherPeriodInput = {
  periodNumber: number;
  classId?: string | null;
  subjectId?: string | null;
};

async function ensureTeacherPeriods(schoolId: string, teacherId: string) {
  const [existing, available, teachers] = await Promise.all([
    prisma.teacherPeriodAssignment.findMany({
      where: { schoolId, teacherId },
      select: { periodNumber: true }
    }),
    prisma.subject.findMany({
      where: { schoolId, classId: { not: null } },
      select: { id: true, classId: true, class: { select: { name: true, section: true } }, name: true }
    }),
    prisma.user.findMany({
      where: { schoolId, role: UserRole.TEACHER, isActive: true },
      select: { id: true },
      orderBy: [{ fullName: "asc" }, { id: "asc" }]
    })
  ]);
  const existingPeriods = new Set(existing.map((period) => period.periodNumber));
  const missing = Array.from({ length: 8 }, (_, index) => index + 1).filter((periodNumber) => !existingPeriods.has(periodNumber));
  if (missing.length === 0) return;

  const sortedAvailable = available.sort((a, b) => {
    const classCompare = `${a.class?.name ?? ""}-${a.class?.section ?? ""}`.localeCompare(`${b.class?.name ?? ""}-${b.class?.section ?? ""}`);
    return classCompare || a.name.localeCompare(b.name);
  });
  const teacherIndex = Math.max(0, teachers.findIndex((teacher) => teacher.id === teacherId));
  const offset = sortedAvailable.length > 0 ? (teacherIndex * 7) % sortedAvailable.length : 0;

  await prisma.teacherPeriodAssignment.createMany({
    data: missing.map((periodNumber) => {
      const assignment = periodNumber === 8 || sortedAvailable.length === 0 ? null : sortedAvailable[(offset + periodNumber - 1) % sortedAvailable.length];
      return {
        schoolId,
        teacherId,
        periodNumber,
        classId: assignment?.classId ?? null,
        subjectId: assignment?.id ?? null
      };
    }),
    skipDuplicates: true
  });
}

function mapPeriod(period: {
  id: string;
  periodNumber: number;
  classId: string | null;
  subjectId: string | null;
  class: { id: string; name: string; section: string; academicYear: string } | null;
  subject: { id: string; name: string } | null;
}) {
  return {
    id: period.id,
    periodNumber: period.periodNumber,
    classId: period.classId,
    subjectId: period.subjectId,
    className: period.class ? `${period.class.name}-${period.class.section}` : "Free period",
    subjectName: period.subject?.name ?? "Free period",
    class: period.class,
    subject: period.subject
  };
}

export async function listUsers(schoolId: string, query: unknown, role?: UserRole) {
  const pagination = getPagination(query);
  const where = {
    schoolId,
    ...(role ? { role } : {}),
    ...(pagination.search
      ? {
          OR: [
            { fullName: { contains: pagination.search, mode: "insensitive" as const } },
            { phone: { contains: pagination.search } },
            { email: { contains: pagination.search, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...((query as any).showInactive === "true" || (query as any).showInactive === true ? { isActive: false } : { isActive: true })
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        periodAssignments: {
          orderBy: { periodNumber: "asc" },
          include: {
            class: { select: { id: true, name: true, section: true, academicYear: true } },
            subject: { select: { id: true, name: true } }
          }
        },
        classTeacherFor: { select: { id: true, name: true, section: true } }
      }
    }),
    prisma.user.count({ where })
  ]);

  const teachersMissingPeriods = items.filter((item) => item.role === UserRole.TEACHER && item.periodAssignments.length < 8);
  await Promise.all(teachersMissingPeriods.map((item) => ensureTeacherPeriods(schoolId, item.id)));
  const hydratedItems = role === UserRole.TEACHER && teachersMissingPeriods.length > 0
    ? await prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          periodAssignments: {
            orderBy: { periodNumber: "asc" },
            include: {
              class: { select: { id: true, name: true, section: true, academicYear: true } },
              subject: { select: { id: true, name: true } }
            }
          },
          classTeacherFor: { select: { id: true, name: true, section: true } }
        }
      })
    : items;

  return {
    items: hydratedItems.map((item) => ({
      ...item,
      periodAssignments: "periodAssignments" in item ? item.periodAssignments.map(mapPeriod) : []
    })),
    total,
    page: pagination.page,
    limit: pagination.limit
  };
}

export async function createUser(schoolId: string, data: { fullName: string; email?: string; phone?: string; password: string; role: UserRole }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const phone = data.phone?.trim() || `acct-${randomUUID()}`;
  return prisma.user.create({
    data: { schoolId, fullName: data.fullName, email: data.email, phone, passwordHash, role: data.role },
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });
}

export async function updateUser(schoolId: string, id: string, data: Record<string, unknown>) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  const updateData = {
    ...data,
    ...(data.status === "ACTIVE" ? { isActive: true } : data.status === "INACTIVE" ? { isActive: false } : {})
  };
  return prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });
}

export async function deleteUser(schoolId: string, id: string) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  return prisma.user.update({
    where: { id },
    data: { status: "INACTIVE", isActive: false }
  });
}

export async function activateUser(schoolId: string, id: string) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  return prisma.user.update({
    where: { id },
    data: { status: "ACTIVE", isActive: true }
  });
}

export async function getTeacherAssignments(schoolId: string, teacherId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId, role: UserRole.TEACHER },
    select: { id: true, fullName: true, email: true, phone: true }
  });
  if (!teacher) throw notFound("Teacher");

  await ensureTeacherPeriods(schoolId, teacherId);

  const [periods, classes] = await Promise.all([
    prisma.teacherPeriodAssignment.findMany({
      where: { schoolId, teacherId },
      orderBy: { periodNumber: "asc" },
      include: {
        class: { select: { id: true, name: true, section: true, academicYear: true } },
        subject: { select: { id: true, name: true } }
      }
    }),
    prisma.class.findMany({
      where: { schoolId },
      include: { subjects: { select: { id: true, name: true, teacherId: true }, orderBy: { name: "asc" } } },
      orderBy: [{ name: "asc" }, { section: "asc" }]
    })
  ]);

  return {
    teacher,
    periods: periods.map(mapPeriod),
    classes: classes.map((classRecord) => ({
      id: classRecord.id,
      name: classRecord.name,
      section: classRecord.section,
      academicYear: classRecord.academicYear,
      subjects: classRecord.subjects
    }))
  };
}

export async function updateTeacherAssignments(schoolId: string, teacherId: string, periods: TeacherPeriodInput[]) {
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId, role: UserRole.TEACHER }, select: { id: true } });
  if (!teacher) throw notFound("Teacher");

  const normalized = periods.map((period) => ({
    periodNumber: period.periodNumber,
    classId: period.classId || null,
    subjectId: period.subjectId || null
  }));

  for (const period of normalized) {
    if (!period.classId && period.subjectId) {
      throw new AppError(400, "Subject cannot be assigned without a class", "INVALID_TEACHER_PERIOD");
    }
    if (period.classId && period.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: period.subjectId, schoolId, classId: period.classId },
        select: { id: true }
      });
      if (!subject) throw new AppError(400, "Subject does not belong to the selected class", "INVALID_TEACHER_SUBJECT");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const period of normalized) {
      await tx.teacherPeriodAssignment.upsert({
        where: { teacherId_periodNumber: { teacherId, periodNumber: period.periodNumber } },
        update: { classId: period.classId, subjectId: period.subjectId },
        create: { schoolId, teacherId, periodNumber: period.periodNumber, classId: period.classId, subjectId: period.subjectId }
      });

      if (period.subjectId) {
        await tx.subject.update({ where: { id: period.subjectId }, data: { teacherId } });
      }
    }
  });

  return getTeacherAssignments(schoolId, teacherId);
}
