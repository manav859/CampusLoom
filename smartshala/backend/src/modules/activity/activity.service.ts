import { Prisma, UserRole } from "@prisma/client";
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

function dedupeLogs<T extends { actorId: string | null; entityId: string; entityType: string; action: string; summary: string; createdAt: Date }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const minute = Math.floor(item.createdAt.getTime() / 60_000);
    const key = [item.actorId, item.entityType, item.entityId, item.action, item.summary, minute].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCurrency(value: number) {
  return `₹${(Math.round(value * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function readBody(log: { afterJson: Prisma.JsonValue | null }) {
  const after = log.afterJson;
  if (!after || typeof after !== "object" || Array.isArray(after)) return {} as Record<string, unknown>;
  const body = (after as Record<string, unknown>).body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {} as Record<string, unknown>;
  return body as Record<string, unknown>;
}

function logSearchText(log: { action: string; actor?: { fullName: string; role: UserRole } | null; afterJson: Prisma.JsonValue | null; beforeJson: Prisma.JsonValue | null; entityType: string; summary: string }) {
  return [
    log.summary,
    log.action,
    log.entityType,
    log.actor?.fullName,
    log.actor?.role,
    JSON.stringify(log.beforeJson ?? {}),
    JSON.stringify(log.afterJson ?? {})
  ].join(" ").toLowerCase();
}

async function enrichFeeLog<T extends { action: string; afterJson: Prisma.JsonValue | null; entityType: string; schoolId: string; summary: string }>(log: T): Promise<T> {
  const isFeePayment = /\/fees\/(payment|payments)(?:\?|$|\/)/.test(log.summary);
  const isFeeAdjustment = /\/fees\/(adjustments|fee-adjustments)(?:\?|$|\/)/.test(log.summary);
  if (!isFeePayment && !isFeeAdjustment) return log;

  const body = readBody(log);
  const amount = Number(body.amount ?? 0);
  const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : null;
  const studentId = typeof body.studentId === "string" ? body.studentId : null;
  if (!amount || (!assignmentId && !studentId)) return log;

  const assignment = assignmentId
    ? await prisma.studentFeeAssignment.findFirst({
        where: { id: assignmentId, schoolId: log.schoolId },
        include: { feeStructure: true, student: { include: { class: true } } }
      })
    : await prisma.studentFeeAssignment.findFirst({
        where: { studentId: studentId!, schoolId: log.schoolId },
        include: { feeStructure: true, student: { include: { class: true } } },
        orderBy: { assignedAt: "desc" }
      });

  const student = assignment?.student ?? (studentId ? await prisma.student.findFirst({ where: { id: studentId, schoolId: log.schoolId }, include: { class: true } }) : null);
  if (!student) return log;

  const summary = isFeePayment
    ? `Recorded fee for ${student.fullName} for ${formatCurrency(amount)}`
    : `Applied fee adjustment of ${formatCurrency(amount)} for ${student.fullName}`;

  return {
    ...log,
    action: isFeePayment ? "CREATE" : "UPDATE",
    entityType: "FEE",
    summary,
    afterJson: {
      student: {
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        class: `${student.class.name}-${student.class.section}`
      },
      fee: {
        amount,
        mode: body.mode,
        feeStructure: assignment?.feeStructure.name,
        reason: body.reason,
        notes: body.notes
      }
    }
  };
}

export async function listActivityLogs(user: Express.UserContext, query: ActivityQuery) {
  assertAdmin(user);

  const { limit, page, skip } = pageInfo(query);
  const search = query.search?.trim();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);
  const baseWhere = {
    schoolId: user.schoolId,
    NOT: { entityType: "STUDENTS" }
  } satisfies Prisma.AuditLogWhereInput;
  const whereWithoutSearch = {
    ...baseWhere,
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
    ...(query.entityType ? { entityType: query.entityType } : {})
  } satisfies Prisma.AuditLogWhereInput;
  const where = {
    ...whereWithoutSearch,
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
  } satisfies Prisma.AuditLogWhereInput;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (search) {
    const [candidateItems, todayCount, actors, entityTypes, actions] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereWithoutSearch,
        include: { actor: { select: { id: true, fullName: true, role: true, phone: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 2000
      }),
      prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: today } } }),
      prisma.auditLog.findMany({
        where: { ...baseWhere, actorId: { not: null } },
        distinct: ["actorId"],
        include: { actor: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.auditLog.groupBy({
        by: ["entityType"],
        where: baseWhere,
        _count: { entityType: true },
        orderBy: { _count: { entityType: "desc" } }
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: baseWhere,
        _count: { action: true },
        orderBy: { _count: { action: "desc" } }
      })
    ]);
    const searchText = search.toLowerCase();
    const enriched = await Promise.all(dedupeLogs(candidateItems).map(enrichFeeLog));
    const filtered = enriched.filter((item) => logSearchText(item).includes(searchText));
    const visibleItems = filtered.slice(skip, skip + limit);

    return {
      items: visibleItems,
      meta: {
        limit,
        page,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit))
      },
      stats: {
        todayCount,
        totalCount: await prisma.auditLog.count({ where: baseWhere }),
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

  const [items, total, todayCount, actors, entityTypes, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, role: true, phone: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit * 3
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: today } } }),
    prisma.auditLog.findMany({
      where: { ...baseWhere, actorId: { not: null } },
      distinct: ["actorId"],
      include: { actor: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      where: baseWhere,
      _count: { entityType: true },
      orderBy: { _count: { entityType: "desc" } }
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: baseWhere,
      _count: { action: true },
      orderBy: { _count: { action: "desc" } }
    })
  ]);

  const visibleItems = await Promise.all(dedupeLogs(items).slice(0, limit).map(enrichFeeLog));

  return {
    items: visibleItems,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    },
    stats: {
      todayCount,
      totalCount: await prisma.auditLog.count({ where: baseWhere }),
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
