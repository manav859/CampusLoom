import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { getPagination } from "../../core/pagination.js";
import { AppError, notFound } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { getTenantContext } from "../../tenant/tenantContext.js";

type TeacherPeriodInput = {
  dayOfWeek?: string;
  periodNumber: number;
  classId?: string | null;
  subjectId?: string | null;
};

const timetableDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const timetableDayLabels: Record<(typeof timetableDays)[number], string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday"
};

async function getTimetablePeriodCount(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timetablePeriodCount: true }
  });
  return Math.max(1, Math.min(12, school?.timetablePeriodCount ?? 8));
}

async function ensureTeacherPeriods(schoolId: string, teacherId: string, periodCount: number) {
  const [existing, available, teachers] = await Promise.all([
    prisma.teacherPeriodAssignment.findMany({
      where: { schoolId, teacherId },
      select: { dayOfWeek: true, periodNumber: true }
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
  const existingPeriods = new Set(existing.map((period) => `${period.dayOfWeek}:${period.periodNumber}`));
  const slots = timetableDays.flatMap((dayOfWeek) =>
    Array.from({ length: periodCount }, (_, index) => ({ dayOfWeek, periodNumber: index + 1 }))
  );
  const missing = slots.filter((slot) => !existingPeriods.has(`${slot.dayOfWeek}:${slot.periodNumber}`));
  if (missing.length === 0) return;

  const sortedAvailable = available.sort((a, b) => {
    const classCompare = `${a.class?.name ?? ""}-${a.class?.section ?? ""}`.localeCompare(`${b.class?.name ?? ""}-${b.class?.section ?? ""}`);
    return classCompare || a.name.localeCompare(b.name);
  });
  const teacherIndex = Math.max(0, teachers.findIndex((teacher) => teacher.id === teacherId));
  const offset = sortedAvailable.length > 0 ? (teacherIndex * 7) % sortedAvailable.length : 0;

  await prisma.teacherPeriodAssignment.createMany({
    data: missing.map(({ dayOfWeek, periodNumber }) => {
      const dayOffset = timetableDays.indexOf(dayOfWeek) * periodCount;
      const assignment = periodNumber === periodCount || sortedAvailable.length === 0
        ? null
        : sortedAvailable[(offset + dayOffset + periodNumber - 1) % sortedAvailable.length];
      return {
        schoolId,
        teacherId,
        dayOfWeek,
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
  dayOfWeek: string;
  periodNumber: number;
  classId: string | null;
  subjectId: string | null;
  class: { id: string; name: string; section: string; academicYear: string } | null;
  subject: { id: string; name: string } | null;
}) {
  return {
    id: period.id,
    dayOfWeek: period.dayOfWeek,
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
  const periodCount = await getTimetablePeriodCount(schoolId);
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
          orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
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

  const expectedPeriodRows = timetableDays.length * periodCount;
  const teachersMissingPeriods = items.filter((item) => item.role === UserRole.TEACHER && item.periodAssignments.length < expectedPeriodRows);
  await Promise.all(teachersMissingPeriods.map((item) => ensureTeacherPeriods(schoolId, item.id, periodCount)));
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
            orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
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
      periodAssignments: "periodAssignments" in item ? item.periodAssignments.map(mapPeriod) : [],
      timetablePeriodCount: periodCount
    })),
    total,
    page: pagination.page,
    limit: pagination.limit
  };
}

export async function createUser(schoolId: string, data: { fullName: string; email?: string; phone?: string; password: string; role: UserRole; academicBackground?: string }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const phone = data.phone?.trim() || `acct-${randomUUID()}`;
  return prisma.user.create({
    data: { schoolId, fullName: data.fullName, email: data.email, phone, passwordHash, role: data.role, academicBackground: data.academicBackground },
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });
}

export async function getTeacher(schoolId: string, id: string) {
  const teacher = await prisma.user.findFirst({
    where: { id, schoolId, role: UserRole.TEACHER },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true
    }
  });
  if (!teacher) throw notFound("Teacher");
  return teacher;
}

export async function updateUser(schoolId: string, id: string, data: Record<string, unknown>) {
  const exists = await prisma.user.findFirst({ where: { id, schoolId } });
  if (!exists) throw notFound("User");
  const updateData = {
    ...data,
    ...(data.status === "ACTIVE" ? { isActive: true } : data.status === "INACTIVE" ? { isActive: false } : {})
  };
  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true }
  });

  if (updatedUser.role === "PRINCIPAL" && isMasterDbConfigured()) {
    const tenantSchoolId = getTenantContext()?.schoolId;
    if (tenantSchoolId) {
      await masterPrisma.school.update({
        where: { schoolId: tenantSchoolId },
        data: {
          ownerName: updatedUser.fullName,
          email: updatedUser.email ?? "",
          phone: updatedUser.phone
        }
      }).catch((err) => {
        console.error(`[UserSync] Failed to sync principal details to master DB for schoolId ${tenantSchoolId}:`, err);
      });
    }
  }

  return updatedUser;
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
  const periodCount = await getTimetablePeriodCount(schoolId);
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId, role: UserRole.TEACHER },
    select: { id: true, fullName: true, email: true, phone: true }
  });
  if (!teacher) throw notFound("Teacher");

  await ensureTeacherPeriods(schoolId, teacherId, periodCount);

  const [periods, classes] = await Promise.all([
    prisma.teacherPeriodAssignment.findMany({
      where: { schoolId, teacherId },
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
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
    days: timetableDays.map((id) => ({ id, label: timetableDayLabels[id] })),
    periodCount,
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
  const periodCount = await getTimetablePeriodCount(schoolId);

  const normalized = periods.map((period) => ({
    dayOfWeek: period.dayOfWeek || "MONDAY",
    periodNumber: period.periodNumber,
    classId: period.classId || null,
    subjectId: period.subjectId || null
  }));
  const expectedSlots = timetableDays.flatMap((dayOfWeek) =>
    Array.from({ length: periodCount }, (_, index) => `${dayOfWeek}:${index + 1}`)
  );
  const receivedSlots = new Set(normalized.map((period) => `${period.dayOfWeek}:${period.periodNumber}`));
  if (receivedSlots.size !== expectedSlots.length || expectedSlots.some((slot) => !receivedSlots.has(slot))) {
    throw new AppError(400, `Provide ${periodCount} periods for each weekday`, "INVALID_TEACHER_TIMETABLE");
  }

  for (const period of normalized) {
    if (!timetableDays.includes(period.dayOfWeek as (typeof timetableDays)[number]) || period.periodNumber < 1 || period.periodNumber > periodCount) {
      throw new AppError(400, "Period is outside the configured timetable", "INVALID_TEACHER_PERIOD");
    }
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

  const occupiedClassSlots = normalized.filter((period) => period.classId);
  if (occupiedClassSlots.length > 0) {
    const conflicts = await prisma.teacherPeriodAssignment.findMany({
      where: {
        schoolId,
        teacherId: { not: teacherId },
        OR: occupiedClassSlots.map((period) => ({
          dayOfWeek: period.dayOfWeek,
          periodNumber: period.periodNumber,
          classId: period.classId
        }))
      },
      include: {
        teacher: { select: { fullName: true } },
        class: { select: { name: true, section: true } }
      },
      take: 1
    });

    const conflict = conflicts[0];
    if (conflict) {
      const className = conflict.class ? `${conflict.class.name}-${conflict.class.section}` : "This class";
      const dayName = timetableDayLabels[conflict.dayOfWeek as (typeof timetableDays)[number]] ?? conflict.dayOfWeek;
      throw new AppError(
        409,
        `${className} is already assigned to ${conflict.teacher.fullName} on ${dayName}, period ${conflict.periodNumber}`,
        "TEACHER_TIMETABLE_CONFLICT"
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacherPeriodAssignment.deleteMany({
      where: {
        schoolId,
        teacherId,
        OR: [
          { dayOfWeek: { notIn: [...timetableDays] } },
          { periodNumber: { gt: periodCount } }
        ]
      }
    });

    for (const period of normalized) {
      await tx.teacherPeriodAssignment.upsert({
        where: { teacherId_dayOfWeek_periodNumber: { teacherId, dayOfWeek: period.dayOfWeek, periodNumber: period.periodNumber } },
        update: { classId: period.classId, subjectId: period.subjectId },
        create: { schoolId, teacherId, dayOfWeek: period.dayOfWeek, periodNumber: period.periodNumber, classId: period.classId, subjectId: period.subjectId }
      });

      if (period.subjectId) {
        await tx.subject.update({ where: { id: period.subjectId }, data: { teacherId } });
      }
    }
  });

  return getTeacherAssignments(schoolId, teacherId);
}
