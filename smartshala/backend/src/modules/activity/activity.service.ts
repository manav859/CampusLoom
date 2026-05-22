import { UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError } from "../../core/errors.js";

type ActivityQuery = {
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  entityType?: string;
  limit?: string;
  page?: string;
  search?: string;
};

function assertAdmin(user: Express.UserContext) {
  if (user.role !== UserRole.PRINCIPAL && user.role !== UserRole.ADMIN) {
    throw new AppError(403, "Only principal and admin can view activity logs", "FORBIDDEN");
  }
}

function pageInfo(query: ActivityQuery) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.limit ?? 25) || 25));
  return { limit, page, skip: (page - 1) * limit };
}

export async function listActivityLogs(user: Express.UserContext, query: ActivityQuery) {
  assertAdmin(user);

  const { limit, page, skip } = pageInfo(query);
  const search = query.search?.trim();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);
  const where = {
    schoolId: user.schoolId,
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && !Number.isNaN(dateFrom.getTime()) ? { gte: dateFrom } : {}),
            ...(dateTo && !Number.isNaN(dateTo.getTime()) ? { lte: dateTo } : {})
          }
        }
      : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" as const } },
            { action: { contains: search, mode: "insensitive" as const } },
            { entityType: { contains: search, mode: "insensitive" as const } },
            { actor: { fullName: { contains: search, mode: "insensitive" as const } } }
          ]
        }
      : {})
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [items, total, todayCount, actors, entityTypes, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, role: true, phone: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { schoolId: user.schoolId, createdAt: { gte: today } } }),
    prisma.auditLog.findMany({
      where: { schoolId: user.schoolId, actorId: { not: null } },
      distinct: ["actorId"],
      include: { actor: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      where: { schoolId: user.schoolId },
      _count: { entityType: true },
      orderBy: { _count: { entityType: "desc" } }
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { schoolId: user.schoolId },
      _count: { action: true },
      orderBy: { _count: { action: "desc" } }
    })
  ]);

  return {
    items,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    },
    stats: {
      todayCount,
      totalCount: await prisma.auditLog.count({ where: { schoolId: user.schoolId } }),
      actorCount: actors.filter((item) => item.actor).length,
      entityTypes: entityTypes.map((item) => ({ label: item.entityType, count: item._count.entityType })),
      actions: actions.map((item) => ({ label: item.action, count: item._count.action }))
    },
    filters: {
      actors: actors
        .filter((item) => item.actor)
        .map((item) => ({ id: item.actor!.id, fullName: item.actor!.fullName, role: item.actor!.role })),
      actions: actions.map((item) => item.action),
      entityTypes: entityTypes.map((item) => item.entityType)
    }
  };
}
