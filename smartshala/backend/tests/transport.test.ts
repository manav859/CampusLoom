import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import {
  assignStudents,
  createRoute,
  createVehicle,
  deleteRoute,
  deleteVehicle,
  getRoute,
  overview,
  report,
  unassignStudent,
  updateRoute,
  updateVehicle
} from "../src/modules/transport/transport.service.js";

/**
 * Integration test for Transport. Requires a reachable database (DATABASE_URL).
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
  const school = await prisma.school.create({ data: { name, code: `TR-${randomUUID().slice(0, 8)}` } });
  const classRecord = await prisma.class.create({
    data: { schoolId: school.id, name: "5", section: "A", academicYear: "2026-27" }
  });

  const makeUser = async (fullName: string, role: "PRINCIPAL" | "TEACHER") => {
    const record = await prisma.user.create({
      data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role }
    });
    return { id: record.id, schoolId: school.id, role, fullName } as Express.UserContext;
  };

  const makeStudent = (fullName: string, data: { transportRequired?: boolean; transportFeeAmount?: number; isActive?: boolean } = {}) =>
    prisma.student.create({
      data: {
        schoolId: school.id,
        classId: classRecord.id,
        fullName,
        admissionNumber: `ADM-${randomUUID().slice(0, 8)}`,
        parentName: `${fullName} Parent`,
        parentPhone: phone(),
        ...data
      }
    });

  return { school, makeUser, makeStudent };
}

async function main() {
  const home = await makeSchool("Transport Test School");
  const other = await makeSchool("Other Transport School");

  const principal = await home.makeUser("Transport Principal", "PRINCIPAL");
  const teacher = await home.makeUser("Transport Teacher", "TEACHER");
  const otherPrincipal = await other.makeUser("Other Principal", "PRINCIPAL");

  const asha = await home.makeStudent("Asha Rider", { transportRequired: true, transportFeeAmount: 1500 });
  const bhavin = await home.makeStudent("Bhavin Rider", { transportRequired: true, transportFeeAmount: 1500 });
  const chirag = await home.makeStudent("Chirag Walker");
  const left = await home.makeStudent("Left School", { transportRequired: true, isActive: false });
  const outsider = await other.makeStudent("Other School Kid", { transportRequired: true });

  try {
    // ------------------------------------------------------------ vehicles
    const bus = await createVehicle(principal, {
      registrationNumber: "gj 01 ab-1234",
      capacity: 2,
      driverName: "Ramesh Patel",
      driverPhone: "9876543210"
    });
    assert.equal(bus.registrationNumber, "GJ01AB1234", "registration is stored without spaces or dashes, upper case");

    await expectAppError(
      createVehicle(principal, { registrationNumber: "GJ01AB1234", capacity: 40, driverName: null }),
      "VEHICLE_EXISTS",
      409
    );
    // Another school may use the same registration: vehicles are per school.
    await createVehicle(otherPrincipal, { registrationNumber: "GJ01AB1234", capacity: 40, driverName: null });

    const van = await createVehicle(principal, { registrationNumber: "GJ01VN0001", capacity: 10, driverName: null });
    const renamed = await updateVehicle(principal, van.id, {
      registrationNumber: "GJ01VN0002",
      capacity: 12,
      driverName: "Suresh",
      driverPhone: null
    });
    assert.equal(renamed.capacity, 12);
    await expectAppError(
      updateVehicle(principal, van.id, { registrationNumber: "GJ01AB1234", capacity: 12, driverName: null }),
      "VEHICLE_EXISTS",
      409
    );
    await expectAppError(
      updateVehicle(otherPrincipal, van.id, { registrationNumber: "X1234", capacity: 1, driverName: null }),
      "NOT_FOUND",
      404
    );

    // -------------------------------------------------------------- routes
    const route = await createRoute(principal, {
      name: "Route 1 - Satellite",
      vehicleId: bus.id,
      stops: [
        { name: "Shivranjani", pickupTime: "07:10", dropTime: "14:20" },
        { name: "Jodhpur Char Rasta", pickupTime: "07:20", dropTime: "14:10" }
      ]
    });
    assert.deepEqual(route.stops.map((stop) => [stop.sequence, stop.name]), [
      [1, "Shivranjani"],
      [2, "Jodhpur Char Rasta"]
    ]);
    assert.equal(route.vehicle?.id, bus.id);

    await expectAppError(createRoute(principal, { name: "route 1 - satellite", stops: [] }), "ROUTE_EXISTS", 409);
    await expectAppError(
      createRoute(otherPrincipal, { name: "Borrowed Bus", vehicleId: bus.id, stops: [] }),
      "NOT_FOUND",
      404
    );

    const [firstStop, secondStop] = route.stops;

    // --------------------------------------------------------- assignments
    await assignStudents(principal, { studentIds: [asha.id, bhavin.id], routeId: route.id, stopId: firstStop.id });
    await assignStudents(principal, { studentIds: [chirag.id], routeId: route.id, stopId: secondStop.id });

    const feesUntouched = await prisma.student.findMany({
      where: { id: { in: [asha.id, chirag.id] } },
      select: { id: true, transportRequired: true, transportFeeAmount: true }
    });
    assert.deepEqual(
      feesUntouched.map((row) => [row.id === asha.id, row.transportRequired, Number(row.transportFeeAmount)]).sort(),
      [
        [false, false, 0],
        [true, true, 1500]
      ].sort(),
      "assigning a route never changes transportRequired or the transport fee"
    );

    await expectAppError(
      assignStudents(principal, { studentIds: [outsider.id], routeId: route.id }),
      "NOT_FOUND",
      404
    );
    await expectAppError(
      assignStudents(principal, { studentIds: [left.id], routeId: route.id }),
      "NOT_FOUND",
      404
    );
    const otherRoute = await createRoute(otherPrincipal, { name: "Other Route", stops: [{ name: "Far Stop" }] });
    await expectAppError(
      assignStudents(principal, { studentIds: [asha.id], routeId: otherRoute.id }),
      "NOT_FOUND",
      404
    );
    await expectAppError(
      assignStudents(principal, { studentIds: [asha.id], routeId: route.id, stopId: otherRoute.stops[0].id }),
      "STOP_NOT_ON_ROUTE",
      400
    );

    const detail = await getRoute(principal, route.id);
    assert.deepEqual(detail.students.map((student) => student.fullName), ["Asha Rider", "Bhavin Rider", "Chirag Walker"]);
    assert.equal(detail.students[0].className, "5-A");
    assert.equal(detail.students[0].stopId, firstStop.id);

    // ------------------------------------------------------------- report
    let summary = await report(principal);
    const reported = summary.routes.find((row) => row.id === route.id)!;
    assert.equal(reported.students, 3);
    assert.equal(reported.capacity, 2);
    assert.equal(reported.occupancy, 150);
    assert.equal(reported.overCapacity, true, "three riders on a two-seat bus is over capacity");
    assert.deepEqual(reported.stops.map((stop) => stop.students), [2, 1]);
    assert.equal(reported.withoutStop, 0);
    assert.deepEqual(summary.notMarked.map((row) => [row.fullName, row.routeName]), [["Chirag Walker", "Route 1 - Satellite"]]);
    assert.deepEqual(summary.needsRoute.map((row) => row.fullName), [], "the inactive student is not listed");
    assert.equal(summary.summary.routesOverCapacity, 1);

    const otherReport = await report(otherPrincipal);
    assert.deepEqual(otherReport.needsRoute.map((row) => row.fullName), ["Other School Kid"]);
    assert.ok(otherReport.routes.every((row) => row.id !== route.id), "another school never sees this route");

    // -------------------------------------------------------- route edits
    // Keep stop 2 (renamed, now first), drop stop 1, add a new stop.
    const edited = await updateRoute(principal, route.id, {
      name: "Route 1 - Satellite",
      vehicleId: van.id,
      stops: [
        { id: secondStop.id, name: "Jodhpur Cross Roads", pickupTime: "07:15" },
        { name: "Iscon", pickupTime: "07:30" }
      ]
    });
    assert.deepEqual(edited.stops.map((stop) => [stop.sequence, stop.name]), [
      [1, "Jodhpur Cross Roads"],
      [2, "Iscon"]
    ]);
    assert.equal(edited.stops[0].id, secondStop.id, "a stop sent with its id keeps its row");
    const byName = new Map(edited.students.map((student) => [student.fullName, student.stopId]));
    assert.equal(byName.get("Chirag Walker"), secondStop.id, "students at a kept stop stay there");
    assert.equal(byName.get("Asha Rider"), null, "students at a removed stop stay on the route without a stop");

    await expectAppError(
      updateRoute(principal, route.id, { name: "Route 1 - Satellite", stops: [{ id: otherRoute.stops[0].id, name: "Stolen" }] }),
      "STOP_NOT_ON_ROUTE",
      400
    );
    const second = await createRoute(principal, { name: "Route 2", stops: [] });
    await expectAppError(updateRoute(principal, second.id, { name: "ROUTE 1 - SATELLITE", stops: [] }), "ROUTE_EXISTS", 409);

    summary = await report(principal);
    assert.equal(summary.routes.find((row) => row.id === route.id)!.withoutStop, 2);

    // Moving a student to another route takes them off the first.
    await assignStudents(principal, { studentIds: [bhavin.id], routeId: second.id });
    assert.equal((await getRoute(principal, route.id)).students.length, 2);

    await unassignStudent(principal, chirag.id);
    await expectAppError(unassignStudent(otherPrincipal, asha.id), "NOT_FOUND", 404);

    // ------------------------------------------------------------ deletes
    await deleteVehicle(principal, van.id);
    assert.equal((await getRoute(principal, route.id)).vehicle, null, "a route outlives its vehicle");
    await expectAppError(deleteVehicle(otherPrincipal, bus.id), "NOT_FOUND", 404);

    await deleteRoute(principal, route.id);
    const afterDelete = await prisma.student.findUnique({ where: { id: asha.id } });
    assert.equal(afterDelete?.transportRouteId, null);
    assert.equal(afterDelete?.transportRequired, true, "deleting a route leaves the student record alone");

    summary = await report(principal);
    assert.deepEqual(summary.needsRoute.map((row) => row.fullName), ["Asha Rider"]);

    const view = await overview(principal);
    assert.equal(view.summary.routes, 1);
    assert.equal(view.summary.vehicles, 1);
    assert.equal(view.summary.studentsOnTransport, 1);

    // --------------------------------------------------------------- roles
    await expectAppError(overview(teacher), "FORBIDDEN", 403);
    await expectAppError(report(teacher), "FORBIDDEN", 403);
    await expectAppError(createVehicle(teacher, { registrationNumber: "GJ00", capacity: 1, driverName: null }), "FORBIDDEN", 403);
    await expectAppError(assignStudents(teacher, { studentIds: [asha.id], routeId: second.id }), "FORBIDDEN", 403);

    console.log("transport.test.ts: all assertions passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [home.school.id, other.school.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
