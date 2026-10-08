import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import {
  calculateMonth,
  deleteShift,
  generateSlips,
  listShifts,
  savePayProfile,
  saveShift
} from "../src/modules/payroll/payrollCalc.service.js";

/**
 * Pay calculated from punches against shifts. Requires a reachable database
 * (DATABASE_URL). September 2026: 26 Mondays-to-Saturdays, one holiday, so 25
 * working days and a day's rate of salary ÷ 25.
 */
const MONTH = "2026-09";
const day = (date: number) => new Date(2026, 8, date);
const at = (date: number, hours: number, minutes = 0) => new Date(2026, 8, date, hours, minutes);

async function expectAppError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof AppError && error.code === code);
}

async function main() {
  const school = await prisma.school.create({ data: { name: "Payroll Shift School", code: `PS-${randomUUID().slice(0, 8)}` } });
  const phone = () => `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
  const joined = new Date(2026, 7, 1);
  const make = (fullName: string, role: "PRINCIPAL" | "TEACHER") =>
    prisma.user.create({ data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role, createdAt: joined } });

  const principal = await make("Principal", "PRINCIPAL");
  const asha = await make("Asha (shift)", "TEACHER");
  const bala = await make("Bala (no shift)", "TEACHER");
  const chetan = await make("Chetan (no salary)", "TEACHER");
  const manager = { id: principal.id, schoolId: school.id, role: "PRINCIPAL", fullName: "Principal" } as Express.UserContext;
  const teacher = { id: asha.id, schoolId: school.id, role: "TEACHER", fullName: asha.fullName } as Express.UserContext;

  try {
    // --- Shifts and pay setup ---------------------------------------------------
    const morning = await saveShift(manager, null, { name: "Morning", startTime: "09:00", endTime: "15:00" });
    assert.equal(morning.minutes, 360);
    await expectAppError(saveShift(manager, null, { name: "Morning", startTime: "10:00", endTime: "16:00" }), "SHIFT_NAME_TAKEN");
    await expectAppError(saveShift(teacher, null, { name: "Evening", startTime: "13:00", endTime: "19:00" }), "FORBIDDEN");
    const night = await saveShift(manager, null, { name: "Night", startTime: "22:00", endTime: "06:00" });
    assert.equal(night.minutes, 480, "a shift past midnight wraps");

    await savePayProfile(manager, asha.id, { monthlySalary: 30000, shiftId: morning.id });
    await savePayProfile(manager, bala.id, { monthlySalary: 26000, shiftId: null });
    assert.equal((await listShifts(manager)).find((shift) => shift.id === morning.id)?.staffCount, 1);

    // --- The month's record ------------------------------------------------------
    await prisma.holiday.create({ data: { schoolId: school.id, date: day(15), reason: "Test holiday" } });

    const punch = (userId: string, date: number, sessions: Array<[Date, Date | null]>, punchedOut = true) =>
      prisma.staffAttendance.create({
        data: {
          schoolId: school.id,
          userId,
          date: day(date),
          punchInAt: sessions[0][0],
          punchOutAt: punchedOut ? sessions[sessions.length - 1][1] : null,
          sessions: { create: sessions.map(([startAt, endAt]) => ({ startAt, endAt })) }
        }
      });

    await punch(asha.id, 1, [[at(1, 9), at(1, 15)]]); // 6h: full
    await punch(asha.id, 2, [[at(2, 9), at(2, 11)]]); // 2h of 6h: half
    await punch(asha.id, 3, [[at(3, 9), at(3, 12)], [at(3, 12, 30), at(3, 15)]]); // 5.5h across a break: full
    await punch(asha.id, 4, [[at(4, 9), null]], false); // never punched out: full, flagged
    const leave = (type: "CASUAL" | "UNPAID", date: number) =>
      prisma.leaveRequest.create({
        data: {
          schoolId: school.id,
          userId: asha.id,
          type,
          status: "APPROVED",
          fromDate: new Date(Date.UTC(2026, 8, date)),
          toDate: new Date(Date.UTC(2026, 8, date)),
          reason: "Test"
        }
      });
    await leave("CASUAL", 5);
    await leave("UNPAID", 7);
    await punch(bala.id, 1, [[at(1, 9), at(1, 10)]]); // no shift: any punch is a full day

    // --- Calculation -----------------------------------------------------------------
    const result = await calculateMonth(manager, MONTH, new Date(2026, 9, 8));
    assert.equal(result.workingDays, 25);

    const rowFor = (id: string) => result.items.find((item) => item.user.id === id)!;
    const a = rowFor(asha.id);
    assert.deepEqual(
      { full: a.days.full, half: a.days.half, leave: a.days.leave, unpaid: a.days.unpaidLeave, absent: a.days.absent, missing: a.days.missingPunchOut },
      { full: 3, half: 1, leave: 1, unpaid: 1, absent: 19, missing: 1 }
    );
    assert.equal(a.deductionDays, 20.5);
    assert.equal(a.dayRate, 1200);
    assert.equal(a.calculatedPay, 30000 - 1200 * 20.5);

    const b = rowFor(bala.id);
    assert.equal(b.days.full, 1);
    assert.equal(b.days.absent, 24);
    assert.equal(b.calculatedPay, 1040);

    const c = rowFor(chetan.id);
    assert.equal(c.monthlySalary, null);
    assert.equal(c.calculatedPay, null);
    assert.equal(rowFor(principal.id).canEdit, false, "nobody records their own pay");

    // --- Slips ------------------------------------------------------------------------
    const generated = await generateSlips(manager, MONTH);
    assert.equal(generated.generated, 2);
    assert.equal(generated.skippedNoSalary, 1);
    const ashaSlip = await prisma.salarySlip.findUniqueOrThrow({ where: { userId_month: { userId: asha.id, month: MONTH } } });
    assert.equal(Number(ashaSlip.basicPay), 30000);
    assert.equal(Number(ashaSlip.deductions), 24600);
    assert.equal(Number(ashaSlip.netPay), 5400);
    assert.equal(ashaSlip.status, "PENDING");
    assert.match(ashaSlip.note ?? "", /3 full, 1 half, 1 paid leave, 1 unpaid leave, 19 absent of 25 working days/);

    // A paid slip is never rewritten.
    await prisma.salarySlip.update({ where: { id: ashaSlip.id }, data: { status: "PAID", paidOn: new Date() } });
    const again = await generateSlips(manager, MONTH);
    assert.equal(again.skippedPaid, 1);
    assert.equal(again.generated, 1);

    // Deleting a shift keeps the salary; days then count on any punch.
    await deleteShift(manager, morning.id);
    const afterDelete = await calculateMonth(manager, MONTH, new Date(2026, 9, 8));
    const a2 = afterDelete.items.find((item) => item.user.id === asha.id)!;
    assert.equal(a2.shift, null);
    assert.equal(a2.monthlySalary, 30000);
    assert.equal(a2.days.half, 0);

    console.log("payrollShifts: all assertions passed");
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
