import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const managerRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ADMIN]);

type VehicleInput = {
  registrationNumber: string;
  capacity: number;
  driverName: string | null;
  driverPhone?: string | null;
};

type StopInput = { id?: string; name: string; pickupTime?: string | null; dropTime?: string | null };
type RouteInput = { name: string; vehicleId?: string | null; stops: StopInput[] };
type AssignmentInput = { studentIds: string[]; routeId: string; stopId?: string | null };

function assertManager(user: Express.UserContext) {
  if (!managerRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Admin can manage transport.", "FORBIDDEN");
  }
}

/** "gj 01 ab 1234" and "GJ01AB1234" are the same vehicle. */
function normalizeRegistration(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const className = (classRecord: { name: string; section: string }) => `${classRecord.name}-${classRecord.section}`;

const vehicleSelect = {
  id: true,
  registrationNumber: true,
  capacity: true,
  driverName: true,
  driverPhone: true
} satisfies Prisma.TransportVehicleSelect;

const stopSelect = {
  id: true,
  sequence: true,
  name: true,
  pickupTime: true,
  dropTime: true
} satisfies Prisma.TransportStopSelect;

const activeStudents = { where: { isActive: true } } as const;

/** Routes with their vehicle, stops and rider count; vehicles with the routes they run. */
export async function overview(user: Express.UserContext) {
  assertManager(user);

  const [routes, vehicles] = await Promise.all([
    prisma.transportRoute.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        vehicle: { select: vehicleSelect },
        stops: { select: stopSelect, orderBy: { sequence: "asc" } },
        _count: { select: { students: activeStudents } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.transportVehicle.findMany({
      where: { schoolId: user.schoolId },
      select: { ...vehicleSelect, routes: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { registrationNumber: "asc" }
    })
  ]);

  const items = routes.map(({ _count, ...route }) => ({ ...route, studentCount: _count.students }));

  return {
    summary: {
      routes: routes.length,
      vehicles: vehicles.length,
      studentsOnTransport: items.reduce((sum, route) => sum + route.studentCount, 0),
      seats: vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
    },
    routes: items,
    vehicles
  };
}

/** One route with the active students who ride it. */
export async function getRoute(user: Express.UserContext, id: string) {
  assertManager(user);

  const route = await prisma.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      name: true,
      vehicle: { select: vehicleSelect },
      stops: { select: stopSelect, orderBy: { sequence: "asc" } },
      students: {
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          parentPhone: true,
          transportRequired: true,
          transportStopId: true,
          class: { select: { name: true, section: true } }
        },
        orderBy: { fullName: "asc" }
      }
    }
  });
  if (!route) throw notFound("Route");

  return {
    ...route,
    students: route.students.map(({ class: classRecord, transportStopId, ...student }) => ({
      ...student,
      className: className(classRecord),
      stopId: transportStopId
    }))
  };
}

// ------------------------------------------------------------------ vehicles

async function saveVehicle(user: Express.UserContext, input: VehicleInput, id?: string) {
  assertManager(user);

  const data = {
    registrationNumber: normalizeRegistration(input.registrationNumber),
    capacity: input.capacity,
    driverName: input.driverName,
    driverPhone: input.driverPhone ?? null
  };

  try {
    if (!id) {
      return await prisma.transportVehicle.create({ data: { ...data, schoolId: user.schoolId }, select: vehicleSelect });
    }
    const existing = await prisma.transportVehicle.findFirst({ where: { id, schoolId: user.schoolId }, select: { id: true } });
    if (!existing) throw notFound("Vehicle");
    return await prisma.transportVehicle.update({ where: { id }, data, select: vehicleSelect });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, `A vehicle with registration ${data.registrationNumber} already exists.`, "VEHICLE_EXISTS");
    }
    throw error;
  }
}

export const createVehicle = (user: Express.UserContext, input: VehicleInput) => saveVehicle(user, input);
export const updateVehicle = (user: Express.UserContext, id: string, input: VehicleInput) => saveVehicle(user, input, id);

/** Routes that used the vehicle keep running without one until another is chosen. */
export async function deleteVehicle(user: Express.UserContext, id: string) {
  assertManager(user);
  const { count } = await prisma.transportVehicle.deleteMany({ where: { id, schoolId: user.schoolId } });
  if (count === 0) throw notFound("Vehicle");
}

// -------------------------------------------------------------------- routes

async function assertVehicle(user: Express.UserContext, vehicleId?: string | null) {
  if (!vehicleId) return;
  const vehicle = await prisma.transportVehicle.findFirst({
    where: { id: vehicleId, schoolId: user.schoolId },
    select: { id: true }
  });
  if (!vehicle) throw notFound("Vehicle");
}

/** Names are unique per school regardless of case, so "Route 1" and "route 1" can't both exist. */
async function assertRouteNameFree(user: Express.UserContext, name: string, exceptId?: string) {
  const clash = await prisma.transportRoute.findFirst({
    where: {
      schoolId: user.schoolId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {})
    },
    select: { id: true }
  });
  if (clash) throw new AppError(409, `A route named "${name}" already exists.`, "ROUTE_EXISTS");
}

export async function createRoute(user: Express.UserContext, input: RouteInput) {
  assertManager(user);
  await assertVehicle(user, input.vehicleId);
  await assertRouteNameFree(user, input.name);

  try {
    const route = await prisma.transportRoute.create({
      data: {
        schoolId: user.schoolId,
        name: input.name,
        vehicleId: input.vehicleId ?? null,
        stops: {
          create: input.stops.map((stop, index) => ({
            sequence: index + 1,
            name: stop.name,
            pickupTime: stop.pickupTime ?? null,
            dropTime: stop.dropTime ?? null
          }))
        }
      },
      select: { id: true }
    });
    return getRoute(user, route.id);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, `A route named "${input.name}" already exists.`, "ROUTE_EXISTS");
    throw error;
  }
}

/**
 * Replaces the route's details and stops. A stop sent with its id is updated in
 * place, so students waiting there stay put; a stop left out is removed, and
 * its students stay on the route with no stop.
 */
export async function updateRoute(user: Express.UserContext, id: string, input: RouteInput) {
  assertManager(user);

  const route = await prisma.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, stops: { select: { id: true } } }
  });
  if (!route) throw notFound("Route");
  await assertVehicle(user, input.vehicleId);
  await assertRouteNameFree(user, input.name, id);

  const existingIds = new Set(route.stops.map((stop) => stop.id));
  const unknown = input.stops.find((stop) => stop.id && !existingIds.has(stop.id));
  if (unknown) throw new AppError(400, "A stop does not belong to this route.", "STOP_NOT_ON_ROUTE");
  const keptIds = new Set(input.stops.flatMap((stop) => (stop.id ? [stop.id] : [])));

  try {
    await prisma.$transaction([
      prisma.transportRoute.update({ where: { id }, data: { name: input.name, vehicleId: input.vehicleId ?? null } }),
      prisma.transportStop.deleteMany({ where: { routeId: id, id: { notIn: [...keptIds] } } }),
      ...input.stops.map((stop, index) => {
        const data = {
          sequence: index + 1,
          name: stop.name,
          pickupTime: stop.pickupTime ?? null,
          dropTime: stop.dropTime ?? null
        };
        return stop.id
          ? prisma.transportStop.update({ where: { id: stop.id }, data })
          : prisma.transportStop.create({ data: { ...data, routeId: id } });
      })
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, `A route named "${input.name}" already exists.`, "ROUTE_EXISTS");
    throw error;
  }

  return getRoute(user, id);
}

/** Its students are left without a route; nothing about their fees changes. */
export async function deleteRoute(user: Express.UserContext, id: string) {
  assertManager(user);
  const { count } = await prisma.transportRoute.deleteMany({ where: { id, schoolId: user.schoolId } });
  if (count === 0) throw notFound("Route");
}

// --------------------------------------------------------------- assignments

/**
 * Puts students on a route, moving them off any other. This only records who
 * rides where: `transportRequired` and the transport fee are left alone, and
 * the report points out where the two disagree.
 */
export async function assignStudents(user: Express.UserContext, input: AssignmentInput) {
  assertManager(user);

  const route = await prisma.transportRoute.findFirst({
    where: { id: input.routeId, schoolId: user.schoolId },
    select: { id: true, stops: { select: { id: true } } }
  });
  if (!route) throw notFound("Route");
  if (input.stopId && !route.stops.some((stop) => stop.id === input.stopId)) {
    throw new AppError(400, "That stop is not on this route.", "STOP_NOT_ON_ROUTE");
  }

  const studentIds = [...new Set(input.studentIds)];
  const found = await prisma.student.count({
    where: { id: { in: studentIds }, schoolId: user.schoolId, isActive: true }
  });
  if (found !== studentIds.length) throw notFound("Student");

  const { count } = await prisma.student.updateMany({
    where: { id: { in: studentIds }, schoolId: user.schoolId },
    data: { transportRouteId: route.id, transportStopId: input.stopId ?? null }
  });
  return { assigned: count };
}

export async function unassignStudent(user: Express.UserContext, studentId: string) {
  assertManager(user);
  const { count } = await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { transportRouteId: null, transportStopId: null }
  });
  if (count === 0) throw notFound("Student");
}

// -------------------------------------------------------------------- report

/**
 * Seats used per route and per stop, plus the two lists that need a decision:
 * students marked as needing transport with no route, and students riding a
 * route whose record says they don't need transport.
 */
export async function report(user: Express.UserContext) {
  assertManager(user);

  const studentSelect = {
    id: true,
    fullName: true,
    admissionNumber: true,
    parentPhone: true,
    class: { select: { name: true, section: true } }
  } satisfies Prisma.StudentSelect;

  const [routes, needsRoute, notMarked] = await Promise.all([
    prisma.transportRoute.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        vehicle: { select: vehicleSelect },
        stops: {
          select: { ...stopSelect, _count: { select: { students: activeStudents } } },
          orderBy: { sequence: "asc" }
        },
        _count: { select: { students: activeStudents } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true, transportRequired: true, transportRouteId: null },
      select: studentSelect,
      orderBy: { fullName: "asc" }
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, isActive: true, transportRequired: false, transportRouteId: { not: null } },
      select: { ...studentSelect, transportRoute: { select: { name: true } } },
      orderBy: { fullName: "asc" }
    })
  ]);

  const routeRows = routes.map((route) => {
    const riders = route._count.students;
    const capacity = route.vehicle?.capacity ?? null;
    const assignedToStops = route.stops.reduce((sum, stop) => sum + stop._count.students, 0);
    return {
      id: route.id,
      name: route.name,
      vehicle: route.vehicle,
      students: riders,
      capacity,
      occupancy: capacity ? Math.round((riders / capacity) * 100) : null,
      overCapacity: capacity !== null && riders > capacity,
      withoutStop: riders - assignedToStops,
      stops: route.stops.map(({ _count, ...stop }) => ({ ...stop, students: _count.students }))
    };
  });

  const toRow = ({ class: classRecord, ...student }: Prisma.StudentGetPayload<{ select: typeof studentSelect }>) => ({
    ...student,
    className: className(classRecord)
  });

  return {
    summary: {
      routes: routeRows.length,
      studentsOnTransport: routeRows.reduce((sum, route) => sum + route.students, 0),
      routesOverCapacity: routeRows.filter((route) => route.overCapacity).length,
      routesWithoutVehicle: routeRows.filter((route) => !route.vehicle).length,
      needsRoute: needsRoute.length,
      notMarked: notMarked.length
    },
    routes: routeRows,
    needsRoute: needsRoute.map(toRow),
    notMarked: notMarked.map(({ transportRoute, ...student }) => ({ ...toRow(student), routeName: transportRoute?.name ?? null }))
  };
}
