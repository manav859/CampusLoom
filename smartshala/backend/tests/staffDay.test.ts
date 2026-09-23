import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { prisma } from "../src/core/prisma.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { staffAttendanceRouter } from "../src/modules/staffAttendance/staffAttendance.routes.js";
import { getStaffDay } from "../src/modules/staffAttendance/staffAttendance.service.js";

/**
 * Integration test for the principal's one-day view of teacher punches.
 * Requires a reachable database (DATABASE_URL). 2026-09-14 is a Monday.
 */
const local = (day: number, hour = 0, minute = 0) => new Date(2026, 8, day, hour, minute);
const utc = (day: number) => new Date(Date.UTC(2026, 8, day));

async function main() {
  const school = await prisma.school.create({ data: { name: "Staff Day School", code: `SD-${randomUUID().slice(0, 8)}` } });
  const otherSchool = await prisma.school.create({ data: { name: "Other School", code: `SX-${randomUUID().slice(0, 8)}` } });

  const makeUser = (schoolId: string, fullName: string, role: "TEACHER" | "ACCOUNTANT" = "TEACHER", isActive = true) =>
    prisma.user.create({
      data: {
        schoolId,
        fullName,
        phone: `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`,
        passwordHash: "x",
        role,
        isActive
      }
    });

  try {
    const anita = await makeUser(school.id, "Anita");      // punched in and out
    const bhavna = await makeUser(school.id, "Bhavna");    // still punched in
    const chetan = await makeUser(school.id, "Chetan");    // approved leave
    const deepak = await makeUser(school.id, "Deepak");    // leave, but punched anyway
    const esha = await makeUser(school.id, "Esha");        // nothing: rejected leave only
    await makeUser(school.id, "Former", "TEACHER", false);
    await makeUser(school.id, "Accounts", "ACCOUNTANT");
    const outsider = await makeUser(otherSchool.id, "Outsider");

    await prisma.staffAttendance.createMany({
      data: [
        { schoolId: school.id, userId: anita.id, date: local(14), punchInAt: local(14, 8, 0), punchOutAt: local(14, 14, 30) },
        { schoolId: school.id, userId: bhavna.id, date: local(14), punchInAt: local(14, 8, 15) },
        { schoolId: school.id, userId: deepak.id, date: local(14), punchInAt: local(14, 9, 0), punchOutAt: local(14, 13, 0) },
        { schoolId: school.id, userId: anita.id, date: local(15), punchInAt: local(15, 8, 0) },
        { schoolId: otherSchool.id, userId: outsider.id, date: local(14), punchInAt: local(14, 8, 0) }
      ]
    });
    await prisma.leaveRequest.createMany({
      data: [
        { schoolId: school.id, userId: chetan.id, type: "SICK", status: "APPROVED", fromDate: utc(13), toDate: utc(15), reason: "Fever" },
        { schoolId: school.id, userId: deepak.id, type: "CASUAL", status: "APPROVED", fromDate: utc(14), toDate: utc(14), reason: "Errand" },
        { schoolId: school.id, userId: esha.id, type: "CASUAL", status: "REJECTED", fromDate: utc(14), toDate: utc(14), reason: "No" }
      ]
    });

    // Viewed on the day itself, at 11:00.
    const today = await getStaffDay(school.id, "2026-09-14", local(14, 11, 0));
    assert.equal(today.total, 5, "active teachers of this school only");
    assert.deepEqual([today.present, today.onLeave, today.notPunchedIn], [3, 1, 1]);
    assert.equal(today.isSunday, false);
    assert.equal(today.holiday, null);
    assert.deepEqual(
      today.staff.map((row) => [row.fullName, row.status]),
      [["Esha", "NOT_PUNCHED_IN"], ["Chetan", "ON_LEAVE"], ["Anita", "PRESENT"], ["Bhavna", "PRESENT"], ["Deepak", "PRESENT"]],
      "not punched in first, then leave, then present; by name within each"
    );
    const byName = new Map(today.staff.map((row) => [row.fullName, row]));
    assert.equal(byName.get("Chetan")!.leaveType, "SICK");
    assert.equal(byName.get("Deepak")!.leaveType, null, "a punch wins over leave");
    assert.equal(byName.get("Anita")!.workedMinutes, 390);
    assert.equal(byName.get("Bhavna")!.workedMinutes, 165, "an open punch today counts up to now");
    assert.equal(byName.get("Bhavna")!.punchOutAt, null);
    assert.equal(byName.get("Esha")!.punchInAt, null);

    // Viewed a day later: Bhavna never punched out, so her hours are unknown.
    const yesterday = await getStaffDay(school.id, "2026-09-14", local(15, 11, 0));
    assert.equal(yesterday.staff.find((row) => row.fullName === "Bhavna")!.workedMinutes, null);

    // The next day: only Anita punched; Chetan's leave runs on.
    const next = await getStaffDay(school.id, "2026-09-15", local(15, 11, 0));
    assert.deepEqual([next.present, next.onLeave, next.notPunchedIn], [1, 1, 3]);

    // A holiday and a Sunday say so.
    await prisma.holiday.create({ data: { schoolId: school.id, date: local(16), reason: "Founders Day" } });
    assert.equal((await getStaffDay(school.id, "2026-09-16")).holiday, "Founders Day");
    assert.equal((await getStaffDay(school.id, "2026-09-13")).isSunday, true);

    // The other school sees only its own teacher.
    const other = await getStaffDay(otherSchool.id, "2026-09-14", local(14, 11, 0));
    assert.deepEqual(other.staff.map((row) => row.fullName), ["Outsider"]);

    // Over HTTP: only the principal and admin may ask, and the date must be a real one.
    const app = express();
    app.use("/staff-attendance", staffAttendanceRouter);
    app.use(errorHandler);
    const server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/staff-attendance/day`;
    const token = (role: "TEACHER" | "PRINCIPAL") =>
      jwt.sign({ schoolId: school.id, role, fullName: role, phone: "9000000000" }, env.JWT_ACCESS_SECRET, {
        subject: randomUUID(),
        expiresIn: "5m"
      });
    const get = (query: string, role: "TEACHER" | "PRINCIPAL") =>
      fetch(`${base}?${query}`, { headers: { Authorization: `Bearer ${token(role)}` } });
    try {
      assert.equal((await get("date=2026-09-14", "TEACHER")).status, 403);
      assert.equal((await get("date=2026-13-01", "PRINCIPAL")).status, 400);
      assert.equal((await get("", "PRINCIPAL")).status, 400);
      const response = await get("date=2026-09-14", "PRINCIPAL");
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { total: number }).total, 5, "the token's school only");
    } finally {
      server.close();
    }

    console.log("staffDay: all assertions passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [school.id, otherSchool.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
