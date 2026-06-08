import { AcademicYearStatus, Prisma } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { recordAuditLog } from "../../core/auditLog.js";
import type { RolloverCommitInput } from "./academicYears.schemas.js";

// ---------------------------------------------------------------------------
// Helpers for the "YYYY-YY" Indian academic-year naming convention.
// ---------------------------------------------------------------------------

function startYearOf(name: string): number | null {
  const match = name.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Default Apr 1 -> Mar 31 span derived from a "YYYY-YY" name. */
export function defaultYearDates(name: string): { startDate: Date; endDate: Date } {
  const year = startYearOf(name) ?? new Date().getFullYear();
  return { startDate: new Date(Date.UTC(year, 3, 1)), endDate: new Date(Date.UTC(year + 1, 2, 31)) };
}

/** "2025-26" -> "2026-27". Falls back to incrementing the leading year. */
export function nextYearName(name: string): string {
  const year = startYearOf(name) ?? new Date().getFullYear();
  return `${year + 1}-${String(year + 2).slice(-2)}`;
}

/** "5" -> "6". Returns null for non-numeric grade names. */
function nextGradeName(name: string): string | null {
  const trimmed = name.trim();
  return /^\d+$/.test(trimmed) ? String(Number(trimmed) + 1) : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listAcademicYears(schoolId: string) {
  return prisma.academicYear.findMany({
    where: { schoolId },
    orderBy: [{ startDate: "desc" }, { name: "desc" }],
    include: { _count: { select: { classes: true } } }
  });
}

export async function getCurrentAcademicYear(schoolId: string) {
  return prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
}

/**
 * Resolve the AcademicYear id for a free-text year name, creating an UPCOMING
 * year (with default Apr–Mar dates) if one does not exist yet. Keeps the FK on
 * classes / fee structures populated as new records are created.
 */
export async function ensureAcademicYear(schoolId: string, name: string): Promise<string> {
  const existing = await prisma.academicYear.findUnique({ where: { schoolId_name: { schoolId, name } } });
  if (existing) return existing.id;
  const created = await prisma.academicYear.create({
    data: { schoolId, name, ...defaultYearDates(name), status: AcademicYearStatus.UPCOMING }
  });
  return created.id;
}

export async function createAcademicYear(schoolId: string, data: { name: string; startDate: Date; endDate: Date }) {
  const existing = await prisma.academicYear.findUnique({ where: { schoolId_name: { schoolId, name: data.name } } });
  if (existing) throw new AppError(409, "An academic year with this name already exists", "ACADEMIC_YEAR_EXISTS");
  return prisma.academicYear.create({ data: { schoolId, ...data, status: AcademicYearStatus.UPCOMING } });
}

// ---------------------------------------------------------------------------
// Rollover preview
// ---------------------------------------------------------------------------

export async function rolloverPreview(schoolId: string, targetName?: string) {
  const currentYear = await getCurrentAcademicYear(schoolId);
  if (!currentYear) throw new AppError(400, "No active academic year to roll over from", "NO_CURRENT_YEAR");

  const classes = await prisma.class.findMany({
    where: { schoolId, academicYearId: currentYear.id },
    include: {
      classTeacher: { select: { id: true, fullName: true } },
      _count: { select: { students: { where: { isActive: true } } } }
    }
  });

  // Highest numeric grade in the school -> graduates by default.
  const numericGrades = classes.map((c) => Number(c.name)).filter((n) => Number.isFinite(n));
  const highestGrade = numericGrades.length ? Math.max(...numericGrades) : null;

  const proposals = classes
    .map((classRecord) => {
      const isFinalGrade = highestGrade !== null && Number(classRecord.name) === highestGrade;
      const proposedTargetName = isFinalGrade ? null : nextGradeName(classRecord.name);
      return {
        sourceClassId: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        studentCount: classRecord._count.students,
        classTeacher: classRecord.classTeacher,
        classTeacherId: classRecord.classTeacherId,
        proposedAction: (isFinalGrade ? "GRADUATE" : "PROMOTE") as "PROMOTE" | "GRADUATE",
        proposedTargetName,
        proposedTargetSection: classRecord.section
      };
    })
    .sort((a, b) => {
      const numA = Number(a.name);
      const numB = Number(b.name);
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
    });

  const currentClassIds = classes.map((c) => c.id);
  const arrears = await summariseArrears(schoolId, currentClassIds);

  return {
    currentYear,
    targetName: targetName ?? nextYearName(currentYear.name),
    targetDates: defaultYearDates(targetName ?? nextYearName(currentYear.name)),
    classes: proposals,
    arrears
  };
}

async function summariseArrears(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) return { totalPending: 0, studentCount: 0 };
  const where: Prisma.StudentFeeAssignmentWhereInput = {
    schoolId,
    pendingAmount: { gt: new Prisma.Decimal(0) },
    student: { isActive: true, classId: { in: classIds } }
  };
  const [agg, students] = await Promise.all([
    prisma.studentFeeAssignment.aggregate({ where, _sum: { pendingAmount: true } }),
    prisma.studentFeeAssignment.groupBy({ by: ["studentId"], where })
  ]);
  return { totalPending: Number(agg._sum.pendingAmount ?? 0), studentCount: students.length };
}

// ---------------------------------------------------------------------------
// Rollover commit (atomic)
// ---------------------------------------------------------------------------

export async function rolloverCommit(schoolId: string, actorId: string, input: RolloverCommitInput) {
  const currentYear = await getCurrentAcademicYear(schoolId);
  if (!currentYear) throw new AppError(400, "No active academic year to roll over from", "NO_CURRENT_YEAR");
  if (input.targetYear.name === currentYear.name) {
    throw new AppError(400, "The new academic year must differ from the current one", "INVALID_TARGET_YEAR");
  }

  const sourceClasses = await prisma.class.findMany({
    where: { schoolId, academicYearId: currentYear.id },
    include: { subjects: { select: { name: true, teacherId: true } } }
  });
  const sourceById = new Map(sourceClasses.map((c) => [c.id, c]));

  for (const mapping of input.mappings) {
    if (!sourceById.has(mapping.sourceClassId)) {
      throw new AppError(400, "A mapped class does not belong to the current academic year", "INVALID_SOURCE_CLASS");
    }
  }

  const dates = {
    startDate: input.targetYear.startDate ?? defaultYearDates(input.targetYear.name).startDate,
    endDate: input.targetYear.endDate ?? defaultYearDates(input.targetYear.name).endDate
  };

  const result = await prisma.$transaction(
    async (tx) => {
      // Resolve/create the target year, guarding against a repeated rollover.
      let targetYear = await tx.academicYear.findUnique({ where: { schoolId_name: { schoolId, name: input.targetYear.name } } });
      if (targetYear) {
        if (targetYear.status !== AcademicYearStatus.UPCOMING) {
          throw new AppError(409, "The target academic year is already active or closed", "TARGET_YEAR_NOT_UPCOMING");
        }
        const existingClasses = await tx.class.count({ where: { schoolId, academicYearId: targetYear.id } });
        if (existingClasses > 0) {
          throw new AppError(409, "Rollover has already been performed for this academic year", "ROLLOVER_ALREADY_DONE");
        }
      } else {
        targetYear = await tx.academicYear.create({
          data: { schoolId, name: input.targetYear.name, ...dates, status: AcademicYearStatus.UPCOMING }
        });
      }

      // Cache of new-year classes keyed by "name|section" so hold-backs and
      // promotions can share / reuse the same destination class.
      const targetClassCache = new Map<string, string>();

      async function ensureTargetClass(name: string, section: string, reference: (typeof sourceClasses)[number], classTeacherId: string | null) {
        const key = `${name}|${section}`;
        const cached = targetClassCache.get(key);
        if (cached) return cached;

        const created = await tx.class.create({
          data: {
            schoolId,
            name,
            section,
            academicYear: targetYear!.name,
            academicYearId: targetYear!.id,
            classTeacherId,
            maximumStrength: reference.maximumStrength,
            stream: reference.stream,
            mediumOfInstruction: reference.mediumOfInstruction
          }
        });
        if (reference.subjects.length > 0) {
          await tx.subject.createMany({
            data: reference.subjects.map((subject) => ({
              schoolId,
              classId: created.id,
              name: subject.name,
              teacherId: subject.teacherId
            })),
            skipDuplicates: true
          });
        }
        targetClassCache.set(key, created.id);
        return created.id;
      }

      let classesCreated = 0;
      let studentsPromoted = 0;
      let studentsHeldBack = 0;
      let studentsGraduated = 0;

      const cacheSizeBefore = () => targetClassCache.size;

      for (const mapping of input.mappings) {
        const source = sourceById.get(mapping.sourceClassId)!;
        const heldBackIds = mapping.heldBackStudentIds ?? [];

        // Held-back students stay in the same grade, but in the new year.
        if (heldBackIds.length > 0) {
          const sizeBefore = cacheSizeBefore();
          const heldClassId = await ensureTargetClass(source.name, source.section, source, source.classTeacherId);
          if (targetClassCache.size > sizeBefore) classesCreated += 1;
          const moved = await tx.student.updateMany({
            where: { schoolId, classId: source.id, isActive: true, id: { in: heldBackIds } },
            data: { classId: heldClassId }
          });
          studentsHeldBack += moved.count;
        }

        if (mapping.action === "PROMOTE") {
          const teacherId = mapping.classTeacherId === undefined ? source.classTeacherId : mapping.classTeacherId;
          const sizeBefore = cacheSizeBefore();
          const targetClassId = await ensureTargetClass(mapping.targetName!, mapping.targetSection!, source, teacherId);
          if (targetClassCache.size > sizeBefore) classesCreated += 1;
          const moved = await tx.student.updateMany({
            where: { schoolId, classId: source.id, isActive: true, id: { notIn: heldBackIds } },
            data: { classId: targetClassId }
          });
          studentsPromoted += moved.count;
        } else {
          // GRADUATE: remaining (non-held-back) students leave the school.
          const graduated = await tx.student.updateMany({
            where: { schoolId, classId: source.id, isActive: true, id: { notIn: heldBackIds } },
            data: { isActive: false }
          });
          studentsGraduated += graduated.count;
        }
      }

      // Arrears: existing pending fee assignments are student-scoped and are
      // left untouched, so they carry forward as previous-year dues.
      const arrears = await summariseArrears(schoolId, Array.from(sourceById.keys()));

      if (input.setCurrent) {
        await tx.academicYear.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false, status: AcademicYearStatus.CLOSED } });
        await tx.academicYear.update({ where: { id: targetYear.id }, data: { isCurrent: true, status: AcademicYearStatus.ACTIVE } });
      }

      return {
        targetYear,
        classesCreated,
        studentsPromoted,
        studentsHeldBack,
        studentsGraduated,
        arrearsCarried: arrears.totalPending
      };
    },
    { timeout: 30000, maxWait: 10000 }
  );

  // The rollover is already committed; never fail it on an audit-log error.
  await recordAuditLog({
    action: "ACADEMIC_YEAR_ROLLOVER",
    actorId,
    entityType: "ACADEMIC_YEAR",
    entityId: result.targetYear.id,
    schoolId,
    summary: `Started academic year ${result.targetYear.name}: ${result.classesCreated} classes created, ${result.studentsPromoted} promoted, ${result.studentsHeldBack} held back, ${result.studentsGraduated} graduated, ₹${result.arrearsCarried} arrears carried`,
    after: {
      targetYear: result.targetYear.name,
      classesCreated: result.classesCreated,
      studentsPromoted: result.studentsPromoted,
      studentsHeldBack: result.studentsHeldBack,
      studentsGraduated: result.studentsGraduated,
      arrearsCarried: result.arrearsCarried,
      setCurrent: input.setCurrent
    }
  }).catch(() => undefined);

  return result;
}
