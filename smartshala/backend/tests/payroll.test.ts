import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { deleteSlip, listMonth, listMySlips, saveSlip } from "../src/modules/payroll/payroll.service.js";

/**
 * Integration test for Payroll. Requires a reachable database (DATABASE_URL).
 * Creates two isolated schools, then deletes them (cascades) at the end.
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

async function makeSchool(name: string) {
  const school = await prisma.school.create({
    data: { name, code: `PR-${randomUUID().slice(0, 8)}` }
  });

  const makeUser = async (fullName: string, role: "PRINCIPAL" | "TEACHER" | "PARENT") => {
    const record = await prisma.user.create({
      data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role }
    });
    return { id: record.id, schoolId: school.id, role, fullName } as Express.UserContext;
  };

  return { school, makeUser };
}

async function main() {
  const home = await makeSchool("Payroll Test School");
  const other = await makeSchool("Other Payroll School");

  const principal = await home.makeUser("Payroll Principal", "PRINCIPAL");
  const teacher = await home.makeUser("Payroll Teacher", "TEACHER");
  const secondTeacher = await home.makeUser("Second Teacher", "TEACHER");
  await home.makeUser("A Parent", "PARENT");
  const otherTeacher = await other.makeUser("Other Teacher", "TEACHER");

  const year = new Date().getFullYear();
  const august = `${year}-08`;
  const september = `${year}-09`;

  try {
    // ------------------------------------------------------------ recording
    const paid = await saveSlip(principal, {
      userId: teacher.id,
      month: august,
      basicPay: 30000,
      allowances: 4500.5,
      deductions: 1800,
      status: "PAID",
      paidOn: `${year}-09-01`,
      note: "Bank transfer"
    });
    assert.equal(paid.netPay, 32700.5, "net pay is earnings minus deductions");
    assert.equal(paid.paidOn, `${year}-09-01`);

    const pending = await saveSlip(principal, {
      userId: teacher.id,
      month: september,
      basicPay: 30000,
      allowances: 0,
      deductions: 0,
      status: "PENDING",
      paidOn: `${year}-09-30`
    });
    assert.equal(pending.paidOn, null, "a pending slip carries no paid date");

    // Saving the same month again replaces it rather than adding a second slip.
    const replaced = await saveSlip(principal, {
      userId: teacher.id,
      month: september,
      basicPay: 31000,
      allowances: 0,
      deductions: 0,
      status: "PENDING"
    });
    assert.equal(replaced.id, pending.id);
    assert.equal(replaced.netPay, 31000);

    await saveSlip(principal, {
      userId: secondTeacher.id,
      month: august,
      basicPay: 99999,
      allowances: 0,
      deductions: 0,
      status: "PAID"
    });

    // ------------------------------------------------------------ rules
    await expectAppError(
      saveSlip(principal, { userId: principal.id, month: august, basicPay: 1, allowances: 0, deductions: 0, status: "PAID" }),
      "CANNOT_RECORD_OWN_SALARY",
      403
    );
    await expectAppError(
      saveSlip(teacher, { userId: secondTeacher.id, month: august, basicPay: 1, allowances: 0, deductions: 0, status: "PAID" }),
      "FORBIDDEN",
      403
    );
    await expectAppError(
      saveSlip(principal, { userId: teacher.id, month: august, basicPay: 1000, allowances: 0, deductions: 1001, status: "PAID" }),
      "NEGATIVE_NET_PAY",
      400
    );
    await expectAppError(
      saveSlip(principal, { userId: otherTeacher.id, month: august, basicPay: 1, allowances: 0, deductions: 0, status: "PAID" }),
      "NOT_FOUND",
      404
    );
    await expectAppError(listMonth(teacher, august), "FORBIDDEN", 403);

    // ------------------------------------------------------------ teacher view
    const mine = await listMySlips(teacher);
    assert.deepEqual(mine.items.map((slip) => slip.month), [september, august], "newest month first");
    assert.equal(mine.summary.latest?.month, september);
    assert.equal(mine.summary.paidThisYear, 32700.5, "only paid slips count toward the year");
    assert.ok(
      mine.items.every((slip) => slip.userId === teacher.id),
      "a teacher never sees another teacher's slip"
    );

    const otherMine = await listMySlips(otherTeacher);
    assert.equal(otherMine.items.length, 0, "another school's teacher sees nothing");

    // ------------------------------------------------------------ month sheet
    const sheet = await listMonth(principal, august);
    assert.equal(sheet.items.length, 3, "principal and both teachers; parents are not staff");
    assert.equal(sheet.summary.recorded, 2);
    assert.equal(sheet.summary.paid, 2);
    assert.equal(sheet.summary.totalNetPay, 32700.5 + 99999);
    assert.equal(sheet.items.find((item) => item.user.id === principal.id)?.canEdit, false);
    assert.ok(!sheet.items.some((item) => item.user.id === otherTeacher.id), "no staff from another school");

    // ------------------------------------------------------------ delete
    await deleteSlip(principal, pending.id);
    await expectAppError(deleteSlip(principal, pending.id), "NOT_FOUND", 404);
    assert.equal((await listMySlips(teacher)).items.length, 1);

    console.log("payroll.test.ts: all assertions passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [home.school.id, other.school.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
