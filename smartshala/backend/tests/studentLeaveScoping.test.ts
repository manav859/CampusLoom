import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import {
  createStudentLeave,
  listStudentLeave,
  decideStudentLeave
} from "../src/modules/studentLeave/studentLeave.service.js";

/**
 * A class teacher works student-leave for only their own class, and can decide
 * it; the office works the whole school. Requires a reachable DATABASE_URL.
 */
async function main() {
  const school = await prisma.school.create({
    data: { name: "Leave Test School", code: `LT-${randomUUID().slice(0, 8)}` }
  });
  const schoolId = school.id;
  const phone = () => `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;

  const teacherA = await prisma.user.create({
    data: { schoolId, fullName: "Teacher A", phone: phone(), passwordHash: "x", role: "TEACHER" }
  });
  const teacherB = await prisma.user.create({
    data: { schoolId, fullName: "Teacher B", phone: phone(), passwordHash: "x", role: "TEACHER" }
  });
  const principal = await prisma.user.create({
    data: { schoolId, fullName: "Principal", phone: phone(), passwordHash: "x", role: "PRINCIPAL" }
  });

  const ctx = (u: { id: string; role: string; fullName: string }) =>
    ({ id: u.id, schoolId, role: u.role, fullName: u.fullName }) as Express.UserContext;

  try {
    const classA = await prisma.class.create({
      data: { schoolId, name: "8", section: "A", academicYear: "2026-27", classTeacherId: teacherA.id }
    });
    const classB = await prisma.class.create({
      data: { schoolId, name: "8", section: "B", academicYear: "2026-27", classTeacherId: teacherB.id }
    });

    const guardian = phone();
    const studentA = await prisma.student.create({
      data: {
        schoolId, classId: classA.id, fullName: "Child A",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, parentName: "P A", parentPhone: guardian
      }
    });
    const studentB = await prisma.student.create({
      data: {
        schoolId, classId: classB.id, fullName: "Child B",
        admissionNumber: `ADM-${randomUUID().slice(0, 6)}`, parentName: "P B", parentPhone: phone()
      }
    });

    const leaveA = await createStudentLeave({
      schoolId, studentId: studentA.id, requestedByPhone: guardian, requestedByName: "P A",
      fromDate: new Date("2026-11-10"), toDate: new Date("2026-11-11"), reason: "Fever"
    });
    await createStudentLeave({
      schoolId, studentId: studentB.id, requestedByPhone: phone(), requestedByName: "P B",
      fromDate: new Date("2026-11-10"), toDate: new Date("2026-11-10"), reason: "Travel"
    });

    // 1. Teacher A sees only their own class's request.
    const aList = await listStudentLeave(ctx(teacherA), { limit: 50, offset: 0 });
    assert.equal(aList.items.length, 1, "Teacher A sees exactly one request");
    assert.equal(aList.items[0].student.fullName, "Child A", "...and it is their own class's");
    assert.equal(aList.summary.PENDING, 1, "Teacher A's counts are scoped too");

    // 2. The principal sees both.
    const pList = await listStudentLeave(ctx(principal), { limit: 50, offset: 0 });
    assert.equal(pList.items.length, 2, "Principal sees the whole school");
    assert.equal(pList.summary.PENDING, 2, "Principal's counts cover the school");

    // 3. Teacher B cannot decide Teacher A's request (scoped lookup → not found).
    await assert.rejects(
      () => decideStudentLeave(ctx(teacherB), leaveA.id, { status: "APPROVED" }),
      /not found|Leave request/i,
      "Teacher B must not decide another class's leave"
    );

    // 4. Teacher A can decide their own.
    const decided = await decideStudentLeave(ctx(teacherA), leaveA.id, { status: "APPROVED", note: "Ok" });
    assert.equal(decided.status, "APPROVED", "Teacher A decides their own class's leave");
    assert.equal(decided.decidedBy?.fullName, "Teacher A", "...attributed to them");

    console.log("studentLeaveScoping: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
