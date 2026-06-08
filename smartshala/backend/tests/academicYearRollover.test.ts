import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AcademicYearStatus } from "@prisma/client";
import { prisma } from "../src/core/prisma.js";
import { rolloverCommit, rolloverPreview } from "../src/modules/academicYears/academicYears.service.js";

/**
 * Integration test for the new-academic-year rollover. Requires a reachable
 * database (DATABASE_URL). Creates an isolated school, runs the rollover, and
 * asserts promotion / hold-back / graduation / arrears behaviour, then cleans
 * up by deleting the school (cascades to all related rows).
 */
async function main() {
  const school = await prisma.school.create({ data: { name: "Rollover Test School", code: `RT-${randomUUID().slice(0, 8)}` } });
  const schoolId = school.id;
  const actor = await prisma.user.create({
    data: { schoolId, fullName: "Test Principal", phone: `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`, passwordHash: "x", role: "PRINCIPAL" }
  });
  const actorId = actor.id;

  try {
    // Current year 2025-26 with two grades: 5 (promotes) and 6 (highest -> graduates).
    const currentYear = await prisma.academicYear.create({
      data: { schoolId, name: "2025-26", startDate: new Date(Date.UTC(2025, 3, 1)), endDate: new Date(Date.UTC(2026, 2, 31)), isCurrent: true, status: AcademicYearStatus.ACTIVE }
    });

    const class5 = await prisma.class.create({ data: { schoolId, name: "5", section: "A", academicYear: "2025-26", academicYearId: currentYear.id } });
    const class6 = await prisma.class.create({ data: { schoolId, name: "6", section: "A", academicYear: "2025-26", academicYearId: currentYear.id } });
    await prisma.subject.createMany({ data: [{ schoolId, classId: class5.id, name: "Mathematics" }, { schoolId, classId: class5.id, name: "Science" }] });

    const mk = (classId: string, name: string, adm: string) =>
      prisma.student.create({ data: { schoolId, classId, fullName: name, admissionNumber: adm, parentName: `${name} Parent`, parentPhone: "9000000000" } });

    const s5a = await mk(class5.id, "Promote One", "A1");
    const s5b = await mk(class5.id, "Promote Two", "A2");
    const s5c = await mk(class5.id, "Hold Back", "A3");
    const s6a = await mk(class6.id, "Graduate One", "A4");
    const s6b = await mk(class6.id, "Graduate Two", "A5");

    // Arrears: one grade-5 student owes money that must survive the rollover.
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId, name: "Annual 2025-26", academicYear: "2025-26", academicYearId: currentYear.id, frequency: "ANNUAL", totalAmount: 10000 }
    });
    await prisma.studentFeeAssignment.create({
      data: { schoolId, studentId: s5a.id, feeStructureId: feeStructure.id, totalAmount: 10000, paidAmount: 4000, pendingAmount: 6000, status: "PARTIAL" }
    });

    // ---- Preview ----
    const preview = await rolloverPreview(schoolId);
    assert.equal(preview.targetName, "2026-27", "default target year");
    assert.equal(preview.arrears.totalPending, 6000, "arrears total");
    assert.equal(preview.arrears.studentCount, 1, "arrears student count");
    const p5 = preview.classes.find((c) => c.name === "5")!;
    const p6 = preview.classes.find((c) => c.name === "6")!;
    assert.equal(p5.proposedAction, "PROMOTE");
    assert.equal(p5.proposedTargetName, "6");
    assert.equal(p6.proposedAction, "GRADUATE", "highest grade graduates");

    // ---- Commit ----
    const result = await rolloverCommit(schoolId, actorId, {
      targetYear: { name: "2026-27" },
      mappings: [
        { sourceClassId: class5.id, action: "PROMOTE", targetName: "6", targetSection: "A", heldBackStudentIds: [s5c.id] },
        { sourceClassId: class6.id, action: "GRADUATE" }
      ],
      setCurrent: true
    });

    assert.equal(result.studentsPromoted, 2, "two promoted");
    assert.equal(result.studentsHeldBack, 1, "one held back");
    assert.equal(result.studentsGraduated, 2, "two graduated");
    assert.equal(result.arrearsCarried, 6000, "arrears carried");
    assert.equal(result.classesCreated, 2, "new 6-A (promote dest) + new 5-A (hold-back dest)");

    // New year is current/active; old year closed.
    const newYear = await prisma.academicYear.findFirstOrThrow({ where: { schoolId, name: "2026-27" } });
    assert.equal(newYear.isCurrent, true);
    assert.equal(newYear.status, AcademicYearStatus.ACTIVE);
    const oldYear = await prisma.academicYear.findFirstOrThrow({ where: { id: currentYear.id } });
    assert.equal(oldYear.isCurrent, false);
    assert.equal(oldYear.status, AcademicYearStatus.CLOSED);

    // Promoted students are in the new-year grade 6; held-back in new-year grade 5.
    const new6 = await prisma.class.findFirstOrThrow({ where: { schoolId, name: "6", section: "A", academicYearId: newYear.id } });
    const new5 = await prisma.class.findFirstOrThrow({ where: { schoolId, name: "5", section: "A", academicYearId: newYear.id } });
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: s5a.id } })).classId, new6.id);
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: s5b.id } })).classId, new6.id);
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: s5c.id } })).classId, new5.id);

    // Subjects were copied to the new grade-6 class.
    assert.equal(await prisma.subject.count({ where: { classId: new6.id } }), 2, "subjects copied");

    // Graduated students are inactive.
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: s6a.id } })).isActive, false);
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: s6b.id } })).isActive, false);

    // Arrears assignment untouched.
    const arrearAssignment = await prisma.studentFeeAssignment.findFirstOrThrow({ where: { studentId: s5a.id } });
    assert.equal(Number(arrearAssignment.pendingAmount), 6000, "pending unchanged");
    assert.equal(arrearAssignment.status, "PARTIAL");

    // ---- Idempotency: a second rollover into the same year is rejected ----
    await assert.rejects(
      () =>
        rolloverCommit(schoolId, actorId, {
          targetYear: { name: "2026-27" },
          mappings: [{ sourceClassId: class5.id, action: "GRADUATE" }],
          setCurrent: true
        }),
      /must differ|already active or closed|already been performed/i,
      "second rollover rejected"
    );

    console.log("academic year rollover tests passed");
  } finally {
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
