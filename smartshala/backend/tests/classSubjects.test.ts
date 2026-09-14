import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { createClass, updateClass } from "../src/modules/classes/classes.service.js";
import { createExamWithMarks, listExams } from "../src/modules/marks/marks.service.js";

/**
 * Integration test for editing a class's subjects, and for scheduling an exam
 * without marks. Requires a reachable database (DATABASE_URL). Creates one
 * school and deletes it (cascades) at the end.
 *
 * Subjects used to be deleted and recreated on every edit, which set every
 * exam, homework and timetable link to those subjects to null.
 */
async function expectAppError(promise: Promise<unknown>, code: string, statusCode: number) {
  try {
    await promise;
    assert.fail(`Expected an AppError with code ${code}, but the call succeeded`);
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
  }
}

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

async function main() {
  const school = await prisma.school.create({ data: { name: "Class Subjects School", code: `CS-${randomUUID().slice(0, 8)}` } });

  try {
    const makeUser = async (role: "PRINCIPAL" | "TEACHER", fullName: string) => {
      const record = await prisma.user.create({
        data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role }
      });
      return { id: record.id, schoolId: school.id, role, fullName } as Express.UserContext;
    };
    const principal = await makeUser("PRINCIPAL", "Subjects Principal");
    const teacher = await makeUser("TEACHER", "Subjects Teacher");
    const otherTeacher = await makeUser("TEACHER", "Other Teacher");

    const created = await createClass(school.id, {
      name: "6",
      section: "A",
      academicYear: "2026-27",
      classTeacherId: teacher.id,
      mediumOfInstruction: "English",
      subjects: ["English", "Mathematics", " English "]
    });
    const subjectsOf = async () =>
      (await prisma.subject.findMany({ where: { classId: created.id }, orderBy: { name: "asc" } })).map((s) => ({ id: s.id, name: s.name }));

    const initial = await subjectsOf();
    assert.deepEqual(initial.map((s) => s.name), ["English", "Mathematics"], "a new class gets its unique subjects");
    const maths = initial.find((s) => s.name === "Mathematics")!;
    const english = initial.find((s) => s.name === "English")!;

    // An exam scheduled with no marks — as the apps now do — links to Mathematics.
    const exam = await createExamWithMarks(principal, {
      classId: created.id,
      subjectId: maths.id,
      name: "Unit Test 1",
      term: "UNIT_TEST",
      maxMarks: 50,
      date: new Date("2026-10-05"),
      results: []
    });
    assert.equal(exam.enteredCount, 0, "a scheduled exam has no results");
    assert.equal(exam.subject, "Mathematics");
    const teacherExams = await listExams(teacher, { classId: created.id });
    assert.deepEqual(teacherExams.map((e) => e.id), [exam.id], "the class teacher can pick the scheduled exam in Marks");

    // Adding a subject keeps the existing rows, so the exam keeps its subject.
    await updateClass(school.id, created.id, { subjects: ["English", "mathematics", "Science"] });
    const afterAdd = await subjectsOf();
    assert.deepEqual(afterAdd.map((s) => s.name), ["English", "Mathematics", "Science"], "matching is case-insensitive");
    assert.equal(afterAdd.find((s) => s.name === "Mathematics")!.id, maths.id, "Mathematics kept its row");
    assert.equal(afterAdd.find((s) => s.name === "English")!.id, english.id, "English kept its row");
    const examRow = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });
    assert.equal(examRow.subjectId, maths.id, "the exam still points at Mathematics");
    const science = await prisma.subject.findFirstOrThrow({ where: { classId: created.id, name: "Science" } });
    assert.equal(science.teacherId, teacher.id, "a new subject goes to the class teacher");

    // Removing a subject an exam uses is refused, and nothing else in the call is applied.
    await expectAppError(
      updateClass(school.id, created.id, { subjects: ["English", "Science"], section: "Z", classTeacherId: otherTeacher.id }),
      "SUBJECT_IN_USE",
      409
    );
    assert.deepEqual((await subjectsOf()).map((s) => s.name), ["English", "Mathematics", "Science"]);
    const unchanged = await prisma.class.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(unchanged.section, "A", "the refused edit changed nothing");
    assert.equal(unchanged.classTeacherId, teacher.id);

    // An unused subject can be removed.
    await updateClass(school.id, created.id, { subjects: ["Mathematics", "Science"] });
    assert.deepEqual((await subjectsOf()).map((s) => s.name), ["Mathematics", "Science"], "English was unused and is gone");

    // Changing only other fields leaves subjects alone.
    await updateClass(school.id, created.id, { maximumStrength: 40 });
    assert.deepEqual((await subjectsOf()).map((s) => s.name), ["Mathematics", "Science"]);

    console.log("class subjects: all assertions passed");
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
