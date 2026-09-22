import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { createExamWithMarks, listExams, marksContext } from "../src/modules/marks/marks.service.js";

/**
 * Integration test for who may examine a subject. A teacher holding periods for
 * a subject in a class teaches it, even when `Subject.teacherId` names someone
 * else, so Create Test and Marks must offer it. Requires a reachable database
 * (DATABASE_URL). Creates an isolated school and deletes it (cascades) at the end.
 */
async function expectAppError(promise: Promise<unknown>, statusCode: number) {
  try {
    await promise;
    assert.fail("Expected an AppError, but the call succeeded");
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.statusCode, statusCode);
  }
}

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

const context = (user: { id: string; schoolId: string; role: string; fullName: string }) => user as Express.UserContext;

const subjectsOf = (result: { classes: { id: string; subjects: { name: string }[] }[] }, classId: string) =>
  (result.classes.find((entry) => entry.id === classId)?.subjects ?? []).map((subject) => subject.name).sort();

async function main() {
  const school = await prisma.school.create({
    data: { name: "Subject Teacher School", code: `ST-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 4 }
  });

  const make = (fullName: string, role: "PRINCIPAL" | "TEACHER") =>
    prisma.user.create({ data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role } });

  const classTeacherRecord = await make("Class Teacher", "TEACHER");
  const subjectTeacherRecord = await make("Subject Teacher", "TEACHER");
  const visitorRecord = await make("Visiting Teacher", "TEACHER");

  const classTeacher = context({ ...classTeacherRecord, schoolId: school.id, role: "TEACHER" });
  const subjectTeacher = context({ ...subjectTeacherRecord, schoolId: school.id, role: "TEACHER" });
  const visitor = context({ ...visitorRecord, schoolId: school.id, role: "TEACHER" });

  try {
    const classRecord = await prisma.class.create({
      data: {
        schoolId: school.id,
        name: "7",
        section: "A",
        academicYear: "2026-2027",
        classTeacherId: classTeacherRecord.id
      }
    });
    const otherClass = await prisma.class.create({
      data: { schoolId: school.id, name: "8", section: "A", academicYear: "2026-2027" }
    });
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        classId: classRecord.id,
        fullName: "Ravi Kumar",
        admissionNumber: `ADM-${randomUUID().slice(0, 8)}`,
        parentName: "Ravi Senior",
        parentPhone: phone()
      }
    });

    // Every subject belongs to the class teacher, which is what the seeding does.
    const maths = await prisma.subject.create({
      data: { schoolId: school.id, classId: classRecord.id, name: "Mathematics", teacherId: classTeacherRecord.id }
    });
    const science = await prisma.subject.create({
      data: { schoolId: school.id, classId: classRecord.id, name: "Science", teacherId: classTeacherRecord.id }
    });
    // Same subject name in another class: the timetable must not leak across classes.
    const otherMaths = await prisma.subject.create({
      data: { schoolId: school.id, classId: otherClass.id, name: "Mathematics", teacherId: null }
    });

    // The subject teacher takes Mathematics in 7-A, and something untimetabled in 8-A.
    await prisma.teacherPeriodAssignment.create({
      data: {
        schoolId: school.id,
        teacherId: subjectTeacherRecord.id,
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        classId: classRecord.id,
        subjectId: maths.id
      }
    });
    // A period with no subject on it: it puts the class in reach but names nothing.
    await prisma.teacherPeriodAssignment.create({
      data: {
        schoolId: school.id,
        teacherId: visitorRecord.id,
        dayOfWeek: "MONDAY",
        periodNumber: 2,
        classId: classRecord.id,
        subjectId: null
      }
    });
    await prisma.teacherPeriodAssignment.create({
      data: {
        schoolId: school.id,
        teacherId: subjectTeacherRecord.id,
        dayOfWeek: "TUESDAY",
        periodNumber: 1,
        classId: otherClass.id,
        subjectId: otherMaths.id
      }
    });

    // --- the subject list each teacher is offered ---
    assert.deepEqual(
      subjectsOf(await marksContext(subjectTeacher), classRecord.id),
      ["Mathematics"],
      "a period for Mathematics offers Mathematics, and not the whole class"
    );
    assert.deepEqual(
      subjectsOf(await marksContext(classTeacher), classRecord.id),
      ["Mathematics", "Science"],
      "the class teacher still gets every subject in their class"
    );
    assert.deepEqual(
      subjectsOf(await marksContext(visitor), classRecord.id),
      [],
      "a period with no subject on it offers nothing"
    );

    // Seeding no longer hands every subject to the class teacher: marksContext
    // ran three times above and Mathematics in 8-A had no teacher throughout.
    assert.equal(
      (await prisma.subject.findUniqueOrThrow({ where: { id: otherMaths.id } })).teacherId,
      null,
      "a subject in a class with no class teacher is left alone"
    );

    // --- creating a test ---
    const exam = await createExamWithMarks(subjectTeacher, {
      classId: classRecord.id,
      subjectId: maths.id,
      name: "Unit Test 1",
      term: "UNIT_TEST",
      maxMarks: 20,
      date: new Date("2026-09-21T00:00:00.000Z"),
      results: [{ studentId: student.id, marks: 15 }]
    });
    assert.equal(exam.subject, "Mathematics");

    await expectAppError(
      createExamWithMarks(subjectTeacher, {
        classId: classRecord.id,
        subjectId: science.id,
        name: "Science Test",
        term: "UNIT_TEST",
        maxMarks: 20,
        date: new Date("2026-09-21T00:00:00.000Z"),
        results: []
      }),
      404
    );
    await expectAppError(
      createExamWithMarks(visitor, {
        classId: classRecord.id,
        subjectId: maths.id,
        name: "Visitor Test",
        term: "UNIT_TEST",
        maxMarks: 20,
        date: new Date("2026-09-21T00:00:00.000Z"),
        results: []
      }),
      404
    );

    // --- and then finding it again ---
    const own = await listExams(subjectTeacher, { classId: classRecord.id });
    assert.deepEqual(
      own.map((entry) => entry.name),
      ["Unit Test 1"],
      "the teacher who set the test can see it"
    );

    const scienceExam = await createExamWithMarks(classTeacher, {
      classId: classRecord.id,
      subjectId: science.id,
      name: "Science Test",
      term: "UNIT_TEST",
      maxMarks: 20,
      date: new Date("2026-09-21T00:00:00.000Z"),
      results: []
    });
    assert.deepEqual(
      (await listExams(subjectTeacher, { classId: classRecord.id })).map((entry) => entry.name),
      ["Unit Test 1"],
      "a subject they do not teach stays out of their exam list"
    );
    assert.deepEqual(
      (await listExams(classTeacher, { classId: classRecord.id })).map((entry) => entry.name).sort(),
      ["Science Test", "Unit Test 1"],
      "the class teacher sees both"
    );
    assert.ok(scienceExam.id);

    console.log("subjectTeacherMarks.test.ts passed");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
