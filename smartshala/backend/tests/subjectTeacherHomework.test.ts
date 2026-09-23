import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { createAssignment, homeworkContext } from "../src/modules/homework/homework.service.js";

/**
 * Integration test for who may set homework for a subject. A teacher holding
 * periods for a subject in a class teaches it, even when `Subject.teacherId`
 * names someone else, so Create Homework must offer it. Requires a reachable
 * database (DATABASE_URL). Creates an isolated school and deletes it (cascades)
 * at the end.
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

const dueDate = new Date("2026-09-25T00:00:00.000Z");

async function main() {
  const school = await prisma.school.create({
    data: { name: "Homework Subject School", code: `HS-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 4 }
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
    await prisma.student.create({
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
    const otherScience = await prisma.subject.create({
      data: { schoolId: school.id, classId: otherClass.id, name: "Science", teacherId: null }
    });

    // The subject teacher takes Mathematics in 7-A and Science in 8-A.
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
    await prisma.teacherPeriodAssignment.create({
      data: {
        schoolId: school.id,
        teacherId: subjectTeacherRecord.id,
        dayOfWeek: "TUESDAY",
        periodNumber: 1,
        classId: otherClass.id,
        subjectId: otherScience.id
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

    // --- the subject list each teacher is offered ---
    assert.deepEqual(
      subjectsOf(await homeworkContext(subjectTeacher), classRecord.id),
      ["Mathematics"],
      "a period for Mathematics offers Mathematics, and not the Science they take in another class"
    );
    assert.deepEqual(
      subjectsOf(await homeworkContext(subjectTeacher), otherClass.id),
      ["Science"],
      "and the subject they take in that other class is offered there"
    );
    assert.deepEqual(
      subjectsOf(await homeworkContext(classTeacher), classRecord.id),
      ["Mathematics", "Science"],
      "the class teacher still gets every subject in their class"
    );
    assert.deepEqual(
      subjectsOf(await homeworkContext(visitor), classRecord.id),
      [],
      "a period with no subject on it offers nothing"
    );

    // Seeding fills in only the subjects nobody owns, and 8-A has no class teacher
    // to hand Science to: homeworkContext ran four times above and it stayed free.
    assert.equal(
      (await prisma.subject.findUniqueOrThrow({ where: { id: otherScience.id } })).teacherId,
      null,
      "a subject in a class with no class teacher is left alone"
    );

    // --- setting the homework ---
    const assignment = await createAssignment(subjectTeacher, {
      classId: classRecord.id,
      subjectId: maths.id,
      title: "Exercise 4.2",
      dueDate
    });
    assert.equal(assignment.subject, "Mathematics");
    assert.equal(assignment.totalStudents, 1, "the class roster is handed the homework");

    await expectAppError(
      createAssignment(subjectTeacher, { classId: classRecord.id, subjectId: science.id, title: "Leaf study", dueDate }),
      404
    );
    await expectAppError(
      createAssignment(visitor, { classId: classRecord.id, subjectId: maths.id, title: "Exercise 4.3", dueDate }),
      404
    );

    const classTeacherAssignment = await createAssignment(classTeacher, {
      classId: classRecord.id,
      subjectId: science.id,
      title: "Leaf study",
      dueDate
    });
    assert.equal(classTeacherAssignment.subject, "Science");

    console.log("subjectTeacherHomework.test.ts passed");
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
