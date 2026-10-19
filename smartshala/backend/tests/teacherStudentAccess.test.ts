import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AttendanceStatus, HomeworkSubmissionStatus } from "@prisma/client";
import { prisma } from "../src/core/prisma.js";
import { getStudent, listStudents, studentsNeedingFocus, FOCUS_THRESHOLDS } from "../src/modules/students/students.service.js";

/**
 * Teacher-portal guarantees from the V2 blueprint:
 *
 *  1. A teacher sees whether a student owes money, and never how the family
 *     paid. The profile carries a summary — status and balance — while
 *     individual payments, modes, receipts and the transport fee stay with the
 *     principal. The student list stays fee-free entirely. The same calls as a
 *     principal must still return the detail, so the assertions are meaningful
 *     rather than vacuous.
 *  2. "Students Needing Focus" flags on the published, fee-free thresholds.
 *
 * Requires a reachable database (DATABASE_URL).
 */

// transportFeeAmount is a fee figure stored on the student row itself, so it
// has to be stripped explicitly rather than by omitting a relation.
const FEE_KEYS = ["feeAssignments", "feeBalance", "currentOutstanding", "lastPayment", "transportFeeAmount"];

/** List responses omit fee keys outright for roles without the "fees" tab. */
function assertNoFeeKeys(payload: Record<string, unknown>, where: string) {
  for (const key of FEE_KEYS) {
    assert.equal(key in payload, false, `${where} must not expose "${key}" to a teacher`);
  }
}

/**
 * A teacher's profile view may say what is owed, but never how it was paid.
 * The summary is allowed; the assignment list, individual payments and the
 * transport fee are not.
 */
function assertFeeSummaryOnly(payload: Record<string, unknown>, where: string) {
  assert.deepEqual(payload.feeAssignments ?? [], [], `${where} must return no fee assignments to a teacher`);
  assert.equal("currentOutstanding" in payload, false, `${where} must not expose outstanding dues to a teacher`);
  assert.equal("lastPayment" in payload, false, `${where} must not expose payments to a teacher`);
  assert.equal("transportFeeAmount" in payload, false, `${where} must not expose the transport fee to a teacher`);

  const summary = payload.feeSummary as Record<string, unknown> | null | undefined;
  assert.ok(summary, `${where} must give a teacher a fee summary`);
  assert.equal(typeof summary!.balance, "number", `${where} fee summary needs a numeric balance`);
  assert.ok(
    ["NONE", "PENDING", "PARTIAL", "PAID", "OVERDUE"].includes(String(summary!.status)),
    `${where} fee summary needs a known status, got ${String(summary!.status)}`
  );

  // The summary must carry no trace of how the money arrived.
  for (const key of ["payments", "receipt", "mode", "paidAt"]) {
    assert.equal(key in summary!, false, `${where} fee summary must not expose "${key}"`);
  }
}

async function main() {
  const school = await prisma.school.create({
    data: { name: "Focus Test School", code: `FT-${randomUUID().slice(0, 8)}` }
  });
  const schoolId = school.id;

  const phone = () => `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;

  const teacher = await prisma.user.create({
    data: { schoolId, fullName: "Focus Teacher", phone: phone(), passwordHash: "x", role: "TEACHER" }
  });
  const principal = await prisma.user.create({
    data: { schoolId, fullName: "Focus Principal", phone: phone(), passwordHash: "x", role: "PRINCIPAL" }
  });

  const teacherUser = { id: teacher.id, schoolId, role: "TEACHER", fullName: teacher.fullName } as Express.UserContext;
  const principalUser = { id: principal.id, schoolId, role: "PRINCIPAL", fullName: principal.fullName } as Express.UserContext;

  try {
    // The teacher is the class teacher, so their students are in scope.
    const classRecord = await prisma.class.create({
      data: { schoolId, name: "8", section: "A", academicYear: "2026-27", classTeacherId: teacher.id }
    });

    const healthy = await prisma.student.create({
      data: {
        schoolId, classId: classRecord.id, fullName: "Healthy Student",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, rollNumber: 1,
        parentName: "Parent A", parentPhone: phone()
      }
    });
    const struggling = await prisma.student.create({
      data: {
        schoolId, classId: classRecord.id, fullName: "Struggling Student",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, rollNumber: 2,
        parentName: "Parent B", parentPhone: phone()
      }
    });

    // 10 attendance days: the healthy student attends all, the struggling one
    // misses 6 (40% — under both the 75% and the 60% critical thresholds).
    for (let day = 0; day < 10; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);

      const session = await prisma.attendanceSession.create({
        data: { schoolId, classId: classRecord.id, date, markedById: teacher.id }
      });

      await prisma.attendanceRecord.createMany({
        data: [
          { schoolId, sessionId: session.id, studentId: healthy.id, status: AttendanceStatus.PRESENT },
          {
            schoolId, sessionId: session.id, studentId: struggling.id,
            status: day < 6 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT
          }
        ]
      });
    }

    // Fees exist for both students so the principal has something to see.
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId, classId: classRecord.id, name: "Tuition", totalAmount: 10000, frequency: "ANNUAL", academicYear: "2026-27" }
    });
    for (const student of [healthy, struggling]) {
      await prisma.studentFeeAssignment.create({
        data: {
          schoolId, studentId: student.id, feeStructureId: feeStructure.id,
          totalAmount: 10000, paidAmount: 0, pendingAmount: 10000
        }
      });
    }

    // --- 1. the teacher sees no fee data anywhere -------------------------
    const teacherList = await listStudents(teacherUser, { classId: classRecord.id });
    assert.equal(teacherList.items.length, 2, "teacher should see both students in their class");
    for (const item of teacherList.items) {
      assertNoFeeKeys(item as Record<string, unknown>, "GET /students");
    }

    const teacherProfile = await getStudent(teacherUser, struggling.id) as Record<string, unknown>;
    assertFeeSummaryOnly(teacherProfile, "GET /students/:id");
    assert.equal("attendancePercentage" in teacherProfile, true, "teacher should still get attendance");

    // The profile also advertises which tabs the role may open; "fees" must not
    // be among them, which is what the teacher app keys its UI off.
    const access = teacherProfile.access as { allowedTabs: string[] };
    assert.equal(access.allowedTabs.includes("fees"), false, "teacher must not be offered a fees tab");

    // --- 2. the same calls as principal DO carry fee data ----------------
    const principalList = await listStudents(principalUser, { classId: classRecord.id });
    const principalItem = principalList.items[0] as Record<string, unknown>;
    assert.equal(
      "feeAssignments" in principalItem, true,
      "principal must still receive fee data — otherwise the teacher assertion proves nothing"
    );

    const principalProfile = await getStudent(principalUser, struggling.id) as Record<string, unknown>;
    assert.equal(
      (principalProfile.feeAssignments as unknown[]).length, 1,
      "principal must see the fee assignment the teacher cannot"
    );
    assert.equal(Number(principalProfile.feeBalance), 10000, "principal must see the real balance");
    assert.equal(
      "transportFeeAmount" in principalProfile, true,
      "principal must still receive the transport fee figure"
    );

    // --- 3. focus thresholds --------------------------------------------
    const focus = await studentsNeedingFocus(teacherUser);
    assert.deepEqual(focus.thresholds, FOCUS_THRESHOLDS, "thresholds must be published to the client");

    const flaggedIds = focus.students.map((student) => student.studentId);
    assert.ok(flaggedIds.includes(struggling.id), "40% attendance must be flagged");
    assert.equal(flaggedIds.includes(healthy.id), false, "100% attendance must not be flagged");

    const flagged = focus.students.find((student) => student.studentId === struggling.id)!;
    assert.equal(flagged.attendancePercent, 40);
    assert.ok(flagged.reasons.includes("LOW_ATTENDANCE"));
    assert.equal(flagged.severity, "HIGH", "below the 60% critical line is HIGH");
    assertNoFeeKeys(flagged as unknown as Record<string, unknown>, "needing-focus");

    // --- 4. missing homework counts toward the flag ----------------------
    const subject = await prisma.subject.create({
      data: { schoolId, classId: classRecord.id, name: "Science" }
    });
    for (let index = 0; index < FOCUS_THRESHOLDS.missingHomeworkCount; index++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - index);
      const assignment = await prisma.homeworkAssignment.create({
        data: {
          schoolId, classId: classRecord.id, subjectId: subject.id, title: `HW ${index}`,
          assignedById: teacher.id, assignedDate: dueDate, dueDate
        }
      });
      await prisma.homeworkSubmission.create({
        data: {
          schoolId, assignmentId: assignment.id, studentId: healthy.id,
          status: HomeworkSubmissionStatus.MISSING
        }
      });
    }

    const afterHomework = await studentsNeedingFocus(teacherUser);
    const nowFlagged = afterHomework.students.find((student) => student.studentId === healthy.id);
    assert.ok(nowFlagged, "3 missing homework items must flag a student with perfect attendance");
    assert.equal(nowFlagged!.missingHomeworkCount, FOCUS_THRESHOLDS.missingHomeworkCount);
    assert.deepEqual(nowFlagged!.reasons, ["MISSING_HOMEWORK"]);
    assert.equal(nowFlagged!.severity, "MEDIUM", "a single signal is MEDIUM");

    console.log("teacherStudentAccess: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
