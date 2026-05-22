import { FeeAdjustmentType, InstallmentStatus, NotificationKind, PaymentMode, Prisma } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { prisma, withRetry, isRetryableError } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { recordAuditLog } from "../../core/auditLog.js";
import { buildFeeReceiptMessage } from "../whatsapp/templates.js";
import { sendMessage as sendWhatsAppMessage } from "../whatsapp/whatsapp.service.js";
import { generateReceiptPdf } from "./receipt-pdf.js";

type FeeStructureInput = {
  classId?: string;
  name?: string;
  term?: string;
  academicYear?: string;
  frequency?: "ANNUAL" | "QUARTERLY" | "MONTHLY" | "CUSTOM";
  totalAmount: number;
  dueDate?: Date;
  installments?: { name: string; dueDate: Date; amount: number; sortOrder: number }[];
};

type PaymentInput = {
  assignmentId?: string;
  studentId?: string;
  installmentId?: string;
  amount: number;
  mode: PaymentMode;
  paidAt?: Date;
  upiTransactionId?: string;
  chequeNumber?: string;
  ddNumber?: string;
  gatewayTransactionId?: string;
  bankReference?: string;
  sendReceiptOnWhatsApp?: boolean;
  notes?: string;
};

type FeeAdjustmentInput = {
  assignmentId?: string;
  studentId?: string;
  type: FeeAdjustmentType;
  amount: number;
  reason: string;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return `₹${toMoney(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const nextYear = String(year + 1).slice(-2);
  return `${year}-${nextYear}`;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function publicReceiptUrl(receiptId: string, tenantSchoolId?: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return tenantSchoolId ? `${base}/${tenantSchoolId}/receipt/${receiptId}` : `${base}/receipt/${receiptId}`;
}

function className(classRecord: { name: string; section: string }) {
  return `${classRecord.name}-${classRecord.section}`;
}

function humanizeAdjustmentType(type: FeeAdjustmentType) {
  return type.toLowerCase().replace(/_/g, " ");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeFeeStructureInput(data: FeeStructureInput) {
  const name = data.name ?? data.term;
  if (!name) {
    throw new AppError(400, "Fee term or name is required", "FEE_TERM_REQUIRED");
  }

  const installments = data.installments ?? [
    {
      name,
      dueDate: data.dueDate,
      amount: data.totalAmount,
      sortOrder: 0
    }
  ];

  if (installments.some((installment) => !installment.dueDate)) {
    throw new AppError(400, "Due date is required", "FEE_DUE_DATE_REQUIRED");
  }

  const installmentTotal = installments.reduce((sum, installment) => sum + installment.amount, 0);
  if (Math.round(installmentTotal * 100) !== Math.round(data.totalAmount * 100)) {
    throw new AppError(400, "Installment total must equal total fee amount", "INVALID_INSTALLMENT_TOTAL");
  }

  return {
    classId: data.classId,
    name,
    academicYear: data.academicYear ?? currentAcademicYear(),
    frequency: data.frequency ?? "ANNUAL",
    totalAmount: data.totalAmount,
    installments: installments.map((installment) => ({
      name: installment.name,
      dueDate: installment.dueDate!,
      amount: installment.amount,
      sortOrder: installment.sortOrder
    }))
  };
}

function mapAssignmentSummary(assignment: {
  totalAmount: unknown;
  paidAmount: unknown;
  pendingAmount: unknown;
  status: InstallmentStatus;
}) {
  return {
    total: toNumber(assignment.totalAmount),
    paid: toNumber(assignment.paidAmount),
    balance: toNumber(assignment.pendingAmount),
    balanceAmount: toNumber(assignment.pendingAmount),
    status: assignment.status
  };
}

type LedgerAssignment = {
  id: string;
  feeStructureId: string;
  totalAmount: unknown;
  feeStructure: { name: string };
  payments: {
    id: string;
    amount: unknown;
    mode: PaymentMode;
    upiTransactionId?: string | null;
    chequeNumber?: string | null;
    ddNumber?: string | null;
    gatewayTransactionId?: string | null;
    bankReference?: string | null;
    paidAt: Date;
    createdAt?: Date;
    receipt?: { id: string; receiptNo: string } | null;
  }[];
};

function mapAdjustment(adjustment: {
  id: string;
  type: FeeAdjustmentType;
  amount: unknown;
  reason: string;
  createdAt: Date;
  assignmentId: string;
  recordedBy?: { id: string; fullName: string } | null;
  assignment?: { feeStructure?: { name: string } } | null;
}) {
  return {
    id: adjustment.id,
    type: adjustment.type,
    amount: toNumber(adjustment.amount),
    reason: adjustment.reason,
    createdAt: adjustment.createdAt,
    assignmentId: adjustment.assignmentId,
    feeStructureName: adjustment.assignment?.feeStructure?.name ?? "Fee",
    recordedBy: adjustment.recordedBy ?? null
  };
}

export function buildTransactionLedger(assignments: LedgerAssignment[]) {
  const total = assignments.reduce((sum, assignment) => sum + toNumber(assignment.totalAmount), 0);
  const chronologicalPayments = assignments
    .flatMap((assignment) =>
      assignment.payments.map((payment) => ({
        id: payment.id,
        date: payment.paidAt,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        amount: toNumber(payment.amount),
        mode: payment.mode,
        upiTransactionId: payment.upiTransactionId ?? null,
        chequeNumber: payment.chequeNumber ?? null,
        ddNumber: payment.ddNumber ?? null,
        gatewayTransactionId: payment.gatewayTransactionId ?? null,
        bankReference: payment.bankReference ?? null,
        receiptId: payment.receipt?.id ?? null,
        receiptNo: payment.receipt?.receiptNo ?? null,
        receipt: payment.receipt ? { id: payment.receipt.id, receiptNo: payment.receipt.receiptNo } : null,
        assignmentId: assignment.id,
        feeStructureId: assignment.feeStructureId,
        feeStructureName: assignment.feeStructure.name
      }))
    )
    .sort(
      (left, right) =>
        left.paidAt.getTime() - right.paidAt.getTime() ||
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0) ||
        left.id.localeCompare(right.id)
    );

  let runningBalance = total;
  return chronologicalPayments.map((payment) => {
    runningBalance = toMoney(Math.max(0, runningBalance - payment.amount));
    const { createdAt, ...entry } = payment;
    return {
      ...entry,
      balanceAfter: runningBalance
    };
  });
}

async function generateReceiptNo(tx: Prisma.TransactionClient, schoolId: string, paidAt: Date) {
  const year = paidAt.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const receiptCount = await tx.receipt.count({
    where: {
      schoolId,
      issuedAt: { gte: start, lt: end }
    }
  });

  return `REC-${year}-${String(receiptCount + 1).padStart(5, "0")}`;
}

export async function dashboard(schoolId: string) {
  return withRetry(async () => {
    const now = new Date();
    const activeAssignmentWhere = {
      schoolId,
      feeStructure: { isActive: true }
    } satisfies Prisma.StudentFeeAssignmentWhereInput;
    const overdueAssignmentWhere = {
      ...activeAssignmentWhere,
      pendingAmount: { gt: new Prisma.Decimal(0) },
      feeStructure: { isActive: true, installments: { some: { dueDate: { lt: now } } } }
    } satisfies Prisma.StudentFeeAssignmentWhereInput;

    const pendingAssignmentWhere = {
      ...activeAssignmentWhere,
      pendingAmount: { gt: new Prisma.Decimal(0) }
    } satisfies Prisma.StudentFeeAssignmentWhereInput;

    const [assignmentAgg, overdueAgg, overdueCount, defaulterCount, defaultersList] = await Promise.all([
      prisma.studentFeeAssignment.aggregate({
        where: activeAssignmentWhere,
        _sum: { totalAmount: true, paidAmount: true, pendingAmount: true }
      }),
      prisma.studentFeeAssignment.aggregate({
        where: overdueAssignmentWhere,
        _sum: { pendingAmount: true }
      }),
      prisma.studentFeeAssignment.count({
        where: overdueAssignmentWhere
      }),
      prisma.studentFeeAssignment.count({
        where: pendingAssignmentWhere
      }),
      prisma.studentFeeAssignment.findMany({
        where: pendingAssignmentWhere,
        include: {
          student: { include: { class: true } },
          feeStructure: { include: { installments: { orderBy: { dueDate: "asc" }, take: 1 } } }
        },
        orderBy: { pendingAmount: "desc" },
        take: 10
      })
    ]);

    return {
      totalDue: toNumber(assignmentAgg._sum.totalAmount),
      totalCollected: toNumber(assignmentAgg._sum.paidAmount),
      totalPending: toNumber(assignmentAgg._sum.pendingAmount),
      totalOverdue: toNumber(overdueAgg._sum.pendingAmount),
      overdueInstallments: overdueCount,
      defaulterCount,
      topDefaulters: defaultersList
    };
  }, { label: "feesDashboard" });
}

export async function createFeeStructure(schoolId: string, data: FeeStructureInput) {
  return withRetry(async () => {
    const normalized = normalizeFeeStructureInput(data);

    if (normalized.classId) {
      const classRecord = await prisma.class.findFirst({ where: { id: normalized.classId, schoolId } });
      if (!classRecord) throw notFound("Class");
    }

    return prisma.feeStructure.create({
      data: {
        schoolId,
        classId: normalized.classId,
        name: normalized.name,
        academicYear: normalized.academicYear,
        frequency: normalized.frequency,
        totalAmount: normalized.totalAmount,
        installments: {
          create: normalized.installments.map((installment) => ({
            name: installment.name,
            dueDate: installment.dueDate,
            amount: installment.amount,
            sortOrder: installment.sortOrder
          }))
        }
      },
      include: { class: true, installments: { orderBy: { sortOrder: "asc" } } }
    });
  }, { label: "createFeeStructure" });
}

export async function listFeeStructures(schoolId: string) {
  return withRetry(() => prisma.feeStructure.findMany({
    where: { schoolId },
    include: { class: true, installments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" }
  }), { label: "listFeeStructures" });
}

export async function getFeeStructure(schoolId: string, id: string) {
  return withRetry(async () => {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        installments: { orderBy: { sortOrder: "asc" } },
        _count: { select: { assignments: true } }
      }
    });

    if (!feeStructure) throw notFound("Fee structure");
    return feeStructure;
  }, { label: "getFeeStructure" });
}

export async function updateFeeStructure(schoolId: string, id: string, data: Partial<FeeStructureInput> & { classId?: string | null; isActive?: boolean }) {
  return withRetry(async () => {
    const existing = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
      include: { installments: { orderBy: { sortOrder: "asc" } } }
    });
    if (!existing) throw notFound("Fee structure");

    if (data.classId) {
      const classRecord = await prisma.class.findFirst({ where: { id: data.classId, schoolId } });
      if (!classRecord) throw notFound("Class");
    }

    if (data.installments) {
      const installmentTotal = data.installments.reduce((sum, installment) => sum + installment.amount, 0);
      const expectedTotal = data.totalAmount ?? toNumber(existing.totalAmount);
      if (Math.round(installmentTotal * 100) !== Math.round(expectedTotal * 100)) {
        throw new AppError(400, "Installment total must equal total fee amount", "INVALID_INSTALLMENT_TOTAL");
      }
    }

    return prisma.$transaction(async (tx) => {
      if (data.installments) {
        await tx.feeInstallment.deleteMany({ where: { feeStructureId: id } });
      }

      return tx.feeStructure.update({
        where: { id },
        data: {
          classId: data.classId === undefined ? undefined : data.classId,
          name: data.name,
          academicYear: data.academicYear,
          frequency: data.frequency,
          totalAmount: data.totalAmount,
          isActive: data.isActive,
          installments: data.installments
            ? {
                create: data.installments.map((installment) => ({
                  name: installment.name,
                  dueDate: installment.dueDate,
                  amount: installment.amount,
                  sortOrder: installment.sortOrder
                }))
              }
            : undefined
        },
        include: { class: true, installments: { orderBy: { sortOrder: "asc" } }, _count: { select: { assignments: true } } }
      });
    });
  }, { label: "updateFeeStructure" });
}

export async function duplicateFeeStructure(schoolId: string, id: string) {
  return withRetry(async () => {
    const existing = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
      include: { installments: { orderBy: { sortOrder: "asc" } } }
    });
    if (!existing) throw notFound("Fee structure");

    return prisma.feeStructure.create({
      data: {
        schoolId,
        classId: existing.classId,
        name: `${existing.name} Copy`,
        academicYear: existing.academicYear,
        frequency: existing.frequency,
        totalAmount: existing.totalAmount,
        isActive: false,
        installments: {
          create: existing.installments.map((installment) => ({
            name: installment.name,
            dueDate: installment.dueDate,
            amount: installment.amount,
            sortOrder: installment.sortOrder
          }))
        }
      },
      include: { class: true, installments: { orderBy: { sortOrder: "asc" } }, _count: { select: { assignments: true } } }
    });
  }, { label: "duplicateFeeStructure" });
}

export async function archiveFeeStructure(schoolId: string, id: string) {
  return updateFeeStructure(schoolId, id, { isActive: false });
}

export async function assignFee(schoolId: string, studentId: string, feeStructureId: string) {
  return withRetry(async () => {
    const [student, feeStructure] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true } }),
      prisma.feeStructure.findFirst({ where: { id: feeStructureId, schoolId } })
    ]);

    if (!student) throw notFound("Student");
    if (!feeStructure) throw notFound("Fee structure");

    const existingAssignment = await prisma.studentFeeAssignment.findFirst({
      where: { schoolId, studentId, feeStructureId },
      include: { student: true, feeStructure: true }
    });

    if (existingAssignment) return existingAssignment;

    return prisma.studentFeeAssignment.create({
      data: {
        schoolId,
        studentId,
        feeStructureId,
        totalAmount: feeStructure.totalAmount,
        pendingAmount: feeStructure.totalAmount,
        status: InstallmentStatus.PENDING
      },
      include: { student: true, feeStructure: true }
    });
  }, { label: "assignFee" });
}

export async function assignFeeStructureToClass(schoolId: string, feeStructureId: string) {
  return withRetry(async () => {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id: feeStructureId, schoolId },
      include: { class: true }
    });

    if (!feeStructure) throw notFound("Fee structure");
    if (!feeStructure.classId) {
      throw new AppError(400, "Fee structure must be linked to a class before class assignment", "FEE_STRUCTURE_CLASS_REQUIRED");
    }

    const students = await prisma.student.findMany({
      where: { schoolId, classId: feeStructure.classId, isActive: true },
      select: { id: true }
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.studentFeeAssignment.createMany({
        data: students.map((student) => ({
          schoolId,
          studentId: student.id,
          feeStructureId: feeStructure.id,
          totalAmount: feeStructure.totalAmount,
          pendingAmount: feeStructure.totalAmount,
          status: InstallmentStatus.PENDING
        })),
        skipDuplicates: true
      });

      return tx.studentFeeAssignment.findMany({
        where: { schoolId, feeStructureId: feeStructure.id },
        include: { student: true, feeStructure: true },
        orderBy: { student: { rollNumber: "asc" } }
      });
    });

    return {
      feeStructure,
      class: feeStructure.class,
      eligibleStudents: students.length,
      assignedStudents: result.length,
      assignments: result
    };
  }, { label: "assignFeeStructureToClass" });
}

async function findPayableAssignment(tx: Prisma.TransactionClient, schoolId: string, data: PaymentInput) {
  if (data.assignmentId) {
    return tx.studentFeeAssignment.findFirst({
      where: { id: data.assignmentId, schoolId },
      include: { student: { include: { class: true } }, feeStructure: true }
    });
  }

  return tx.studentFeeAssignment.findFirst({
    where: {
      schoolId,
      studentId: data.studentId,
      pendingAmount: { gt: new Prisma.Decimal(0) }
    },
    include: { student: { include: { class: true } }, feeStructure: true },
    orderBy: { assignedAt: "asc" }
  });
}

async function collectPaymentOnce(user: Express.UserContext, data: PaymentInput) {
  const paidAt = data.paidAt ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await findPayableAssignment(tx, user.schoolId, data);
    if (!assignment) throw notFound("Fee assignment");

    if (data.installmentId) {
      const installment = await tx.feeInstallment.findFirst({
        where: { id: data.installmentId, feeStructureId: assignment.feeStructureId }
      });
      if (!installment) throw notFound("Fee installment");
    }

    const balanceBefore = toNumber(assignment.pendingAmount);
    if (balanceBefore <= 0) {
      throw new AppError(400, "Fee assignment is already paid", "FEE_ALREADY_PAID");
    }

    if (data.amount > balanceBefore) {
      throw new AppError(400, "Payment exceeds pending amount", "PAYMENT_EXCEEDS_BALANCE", {
        balance: balanceBefore
      });
    }

    const paidAmount = toMoney(toNumber(assignment.paidAmount) + data.amount);
    const pendingAmount = toMoney(balanceBefore - data.amount);

    const payment = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        studentId: assignment.studentId,
        assignmentId: assignment.id,
        installmentId: data.installmentId,
        amount: data.amount,
        mode: data.mode,
        upiTransactionId: data.upiTransactionId,
        chequeNumber: data.chequeNumber,
        ddNumber: data.ddNumber,
        gatewayTransactionId: data.gatewayTransactionId,
        bankReference: data.bankReference,
        paidAt,
        notes: data.notes,
        recordedById: user.id
      }
    });

    const updatedAssignment = await tx.studentFeeAssignment.update({
      where: { id: assignment.id },
      data: {
        paidAmount,
        pendingAmount,
        status: pendingAmount === 0 ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL
      },
      include: { student: { include: { class: true } }, feeStructure: true }
    });

    const receipt = await tx.receipt.create({
      data: {
        schoolId: user.schoolId,
        paymentId: payment.id,
        receiptNo: await generateReceiptNo(tx, user.schoolId, paidAt),
        issuedAt: paidAt
      }
    });

    return { payment, receipt, assignment: updatedAssignment };
  });

  const receiptNotificationQueued = data.sendReceiptOnWhatsApp ?? true;
  if (receiptNotificationQueued) {
    queuePaymentReceiptWhatsApp(
      user.schoolId,
      result.assignment.student,
      data.amount,
      result.receipt.receiptNo,
      result.receipt.id,
      user.tenantSchoolId,
      paidAt,
      toNumber(result.assignment.pendingAmount),
      result.assignment.status
    );
  }

  await recordAuditLog({
    action: "CREATE",
    actorId: user.id,
    entityId: result.payment.id,
    entityType: "FEE",
    schoolId: user.schoolId,
    summary: `Recorded fee for ${result.assignment.student.fullName} for ${formatCurrency(toNumber(result.payment.amount))}`,
    before: {
      balance: toMoney(toNumber(result.assignment.pendingAmount) + toNumber(result.payment.amount))
    },
    after: {
      student: {
        id: result.assignment.student.id,
        fullName: result.assignment.student.fullName,
        admissionNumber: result.assignment.student.admissionNumber,
        class: className(result.assignment.student.class)
      },
      fee: {
        amount: toNumber(result.payment.amount),
        mode: result.payment.mode,
        paidAt: result.payment.paidAt,
        receiptNo: result.receipt.receiptNo,
        feeStructure: result.assignment.feeStructure.name,
        balanceAfter: toNumber(result.assignment.pendingAmount),
        status: result.assignment.status,
        notes: result.payment.notes
      }
    }
  }).catch((error) => {
    logger.warn({ err: error, schoolId: user.schoolId, paymentId: result.payment.id }, "Failed to write fee payment activity log");
  });

  return {
    payment: result.payment,
    receipt: result.receipt,
    assignment: result.assignment,
    ledger: mapAssignmentSummary(result.assignment),
    receiptNotificationQueued
  };
}

export async function collectPayment(user: Express.UserContext, data: PaymentInput) {
  if (data.amount <= 0) {
    throw new AppError(400, "Payment amount must be greater than zero", "INVALID_PAYMENT_AMOUNT");
  }

  return withRetry(
    async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          return await collectPaymentOnce(user, data);
        } catch (error) {
          if (attempt < 3 && isUniqueConstraintError(error)) continue;
          throw error;
        }
      }
      throw new AppError(500, "Unable to record payment", "PAYMENT_FAILED");
    },
    { label: "collectPayment" }
  );
}

export async function applyFeeAdjustment(user: Express.UserContext, data: FeeAdjustmentInput) {
  return withRetry(async () => {
    const assignment = data.assignmentId
      ? await prisma.studentFeeAssignment.findFirst({
          where: { id: data.assignmentId, schoolId: user.schoolId },
          include: { student: true, feeStructure: true }
        })
      : await prisma.studentFeeAssignment.findFirst({
          where: { schoolId: user.schoolId, studentId: data.studentId, pendingAmount: { gt: new Prisma.Decimal(0) } },
          include: { student: true, feeStructure: true },
          orderBy: { assignedAt: "asc" }
        });

    if (!assignment) throw notFound("Fee assignment");

    const pendingBefore = toNumber(assignment.pendingAmount);
    if (pendingBefore <= 0) {
      throw new AppError(400, "Fee assignment is already paid", "FEE_ALREADY_PAID");
    }
    if (data.amount > pendingBefore) {
      throw new AppError(400, "Adjustment exceeds pending amount", "ADJUSTMENT_EXCEEDS_BALANCE", {
        balance: pendingBefore
      });
    }

    const amount = toMoney(data.amount);
    const nextTotal = toMoney(toNumber(assignment.totalAmount) - amount);
    const nextPending = toMoney(pendingBefore - amount);

    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.feeAdjustment.create({
        data: {
          schoolId: user.schoolId,
          studentId: assignment.studentId,
          assignmentId: assignment.id,
          recordedById: user.id,
          type: data.type,
          amount,
          reason: data.reason
        },
        include: {
          recordedBy: { select: { id: true, fullName: true } },
          assignment: { include: { feeStructure: true } }
        }
      });

      const updatedAssignment = await tx.studentFeeAssignment.update({
        where: { id: assignment.id },
        data: {
          totalAmount: nextTotal,
          pendingAmount: nextPending,
          status: nextPending === 0 ? InstallmentStatus.PAID : toNumber(assignment.paidAmount) > 0 ? InstallmentStatus.PARTIAL : InstallmentStatus.PENDING
        },
        include: { student: { include: { class: true } }, feeStructure: true }
      });

      return { adjustment, assignment: updatedAssignment };
    });

    await recordAuditLog({
      action: "UPDATE",
      actorId: user.id,
      entityId: result.adjustment.id,
      entityType: "FEE",
      schoolId: user.schoolId,
      summary: `Applied ${humanizeAdjustmentType(data.type)} of ${formatCurrency(amount)} for ${result.assignment.student.fullName}`,
      before: {
        totalAmount: toNumber(assignment.totalAmount),
        pendingAmount: pendingBefore
      },
      after: {
        student: {
          id: result.assignment.student.id,
          fullName: result.assignment.student.fullName,
          admissionNumber: result.assignment.student.admissionNumber,
          class: className(result.assignment.student.class)
        },
        adjustment: {
          type: data.type,
          amount,
          reason: data.reason,
          feeStructure: result.assignment.feeStructure.name
        },
        ledger: {
          totalAmount: toNumber(result.assignment.totalAmount),
          pendingAmount: toNumber(result.assignment.pendingAmount),
          status: result.assignment.status
        }
      }
    }).catch((error) => {
      logger.warn({ err: error, schoolId: user.schoolId, adjustmentId: result.adjustment.id }, "Failed to write fee adjustment activity log");
    });

    return {
      adjustment: mapAdjustment(result.adjustment),
      ledger: mapAssignmentSummary(result.assignment)
    };
  }, { label: "applyFeeAdjustment" });
}

function queuePaymentReceiptWhatsApp(
  schoolId: string,
  student: { id: string; fullName: string; parentPhone: string },
  amount: number,
  receiptNo: string,
  receiptId: string,
  tenantSchoolId: string | undefined,
  paidAt: Date,
  pendingAmount: number,
  status: string
) {
  const phone = student.parentPhone.trim();
  if (!phone) return;

  setTimeout(() => {
    const message = buildFeeReceiptMessage(student.fullName, amount, receiptNo, formatDate(paidAt), pendingAmount, status, publicReceiptUrl(receiptId, tenantSchoolId));
    void sendWhatsAppMessage(phone, message, {
      schoolId,
      studentId: student.id,
      kind: NotificationKind.PAYMENT_RECEIPT
    }).catch((error) => {
      logger.warn({ err: error, schoolId, studentId: student.id, receiptNo }, "Failed to send fee receipt WhatsApp notification");
    });
  }, 10_000);
}

export async function sendReceiptWhatsApp(user: Express.UserContext, receiptId: string) {
  const receipt = await withRetry(() => prisma.receipt.findFirst({
    where: { id: receiptId, schoolId: user.schoolId },
    include: {
      payment: {
        include: {
          student: true,
          assignment: true
        }
      }
    }
  }), { label: "sendReceiptWhatsAppLookup" });

  if (!receipt) throw notFound("Receipt");

  const payment = receipt.payment;
  const student = payment.student;
  const phone = student.parentPhone.trim();

  if (!phone) {
    throw new AppError(400, "Parent WhatsApp number is missing", "PARENT_PHONE_MISSING");
  }

  const message = buildFeeReceiptMessage(
    student.fullName,
    toNumber(payment.amount),
    receipt.receiptNo,
    formatDate(payment.paidAt),
    toNumber(payment.assignment.pendingAmount),
    payment.assignment.status,
    publicReceiptUrl(receipt.id, user.tenantSchoolId)
  );
  const result = await sendWhatsAppMessage(phone, message, {
    schoolId: user.schoolId,
    studentId: student.id,
    kind: NotificationKind.PAYMENT_RECEIPT
  });

  return {
    success: result.success,
    receiptId: receipt.id,
    receiptNo: receipt.receiptNo,
    parentPhone: phone
  };
}

export async function getStudentLedger(schoolId: string, studentId: string) {
  return withRetry(async () => {
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        class: true,
        feeAssignments: {
          include: {
            feeStructure: { include: { installments: { orderBy: { sortOrder: "asc" } } } },
            payments: { include: { receipt: true, installment: true }, orderBy: { paidAt: "desc" } },
            adjustments: {
              include: { recordedBy: { select: { id: true, fullName: true } } },
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { assignedAt: "desc" }
        }
      }
    });

    if (!student) throw notFound("Student");

    const total = student.feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.totalAmount), 0);
    const paid = student.feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.paidAmount), 0);
    const balance = student.feeAssignments.reduce((sum, assignment) => sum + toNumber(assignment.pendingAmount), 0);
    const status = balance === 0 ? InstallmentStatus.PAID : paid > 0 ? InstallmentStatus.PARTIAL : InstallmentStatus.PENDING;
    const transactionLedger = buildTransactionLedger(student.feeAssignments);
    const payments = [...transactionLedger].sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime() || right.id.localeCompare(left.id));

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        class: student.class
      },
      total,
      paid,
      balance,
      status,
      assignments: student.feeAssignments.map((assignment) => ({
        ...assignment,
        ...mapAssignmentSummary(assignment)
      })),
      transactionLedger,
      payments,
      adjustments: student.feeAssignments
        .flatMap((assignment) =>
          assignment.adjustments.map((adjustment) =>
            mapAdjustment({
              ...adjustment,
              assignmentId: assignment.id,
              assignment: { feeStructure: assignment.feeStructure }
            })
          )
        )
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    };
  }, { label: "getStudentLedger" });
}

export async function defaulters(schoolId: string) {
  return withRetry(async () => {
    const today = new Date();
    const assignmentsList = await prisma.studentFeeAssignment.findMany({
      where: {
        schoolId,
        pendingAmount: { gt: new Prisma.Decimal(0) },
        feeStructure: { isActive: true }
      },
      include: {
        student: { include: { class: true } },
        feeStructure: { include: { installments: { orderBy: { dueDate: "asc" } } } }
      }
    });

    return assignmentsList
      .map((assignment) => {
        const dueDate = assignment.feeStructure.installments[0]?.dueDate;
        const daysOverdue = dueDate ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)) : 0;

        return {
          studentId: assignment.studentId,
          name: assignment.student.fullName,
          class: className(assignment.student.class),
          feeStructureId: assignment.feeStructureId,
          feeStructure: assignment.feeStructure.name,
          balance: toNumber(assignment.pendingAmount),
          balanceAmount: toNumber(assignment.pendingAmount),
          dueDate,
          daysOverdue,
          status: assignment.status
        };
      })
      .sort((left, right) => right.daysOverdue - left.daysOverdue || right.balance - left.balance);
  }, { label: "defaulters" });
}

async function buildReceiptPdfFromReceipt(receipt: NonNullable<Awaited<ReturnType<typeof findReceiptForPdf>>>) {
  const payment = receipt.payment;
  const student = payment.student;
  const assignment = payment.assignment;
  const feeStructure = assignment.feeStructure;

  return generateReceiptPdf({
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt,
    school: {
      name: receipt.school.name,
      city: receipt.school.city,
      state: receipt.school.state,
      phone: receipt.school.phone,
      gstin: receipt.school.gstin,
      udiseNumber: receipt.school.udiseNumber,
      affiliationBoard: receipt.school.affiliationBoard,
      logoUrl: receipt.school.logoUrl
    },
    student: {
      fullName: student.fullName,
      admissionNumber: student.admissionNumber,
      class: `${student.class.name}-${student.class.section}`,
      parentName: student.parentName,
      parentPhone: student.parentPhone
    },
    payment: {
      amount: toNumber(payment.amount),
      mode: payment.mode,
      recordedByName: payment.recordedBy.fullName,
      upiTransactionId: payment.upiTransactionId,
      chequeNumber: payment.chequeNumber,
      ddNumber: payment.ddNumber,
      gatewayTransactionId: payment.gatewayTransactionId,
      bankReference: payment.bankReference,
      paidAt: payment.paidAt,
      notes: payment.notes
    },
    feeStructure: {
      name: feeStructure.name,
      academicYear: feeStructure.academicYear,
      totalAmount: toNumber(feeStructure.totalAmount)
    },
    ledger: {
      totalAmount: toNumber(assignment.totalAmount),
      paidAmount: toNumber(assignment.paidAmount),
      pendingAmount: toNumber(assignment.pendingAmount),
      status: assignment.status
    }
  });
}

function findReceiptForPdf(where: Prisma.ReceiptWhereInput) {
  return prisma.receipt.findFirst({
    where,
    include: {
      payment: {
        include: {
          recordedBy: { select: { fullName: true } },
          student: { include: { class: true } },
          assignment: {
            include: {
              feeStructure: true
            }
          }
        }
      },
      school: true
    }
  });
}

export async function getReceiptPdf(schoolId: string, receiptId: string) {
  return withRetry(async () => {
    const receipt = await findReceiptForPdf({ id: receiptId, schoolId });

    if (!receipt) throw notFound("Receipt");
    return buildReceiptPdfFromReceipt(receipt);
  }, { label: "getReceiptPdf" });
}

export async function getPublicReceiptPdf(receiptId: string) {
  return withRetry(async () => {
    const receipt = await findReceiptForPdf({ id: receiptId });
    if (!receipt) throw notFound("Receipt");
    return buildReceiptPdfFromReceipt(receipt);
  }, { label: "getPublicReceiptPdf" });
}

export async function getReceiptByPaymentId(schoolId: string, paymentId: string) {
  return withRetry(() => prisma.receipt.findFirst({
    where: { paymentId, schoolId },
    select: { id: true, receiptNo: true }
  }), { label: "getReceiptByPaymentId" }).then((receipt) => {
    if (!receipt) throw notFound("Receipt");
    return receipt;
  });
}
