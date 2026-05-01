import { InstallmentStatus, NotificationKind, PaymentMode, Prisma } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { prisma, withRetry, isRetryableError } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
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
  notes?: string;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function className(classRecord: { name: string; section: string }) {
  return `${classRecord.name}-${classRecord.section}`;
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
    paidAt: Date;
    createdAt?: Date;
    receipt?: { id: string; receiptNo: string } | null;
  }[];
};

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
    const [assignmentAgg, paymentAgg, overdueCount, defaultersList] = await Promise.all([
      prisma.studentFeeAssignment.aggregate({
        where: { schoolId },
        _sum: { totalAmount: true, paidAmount: true, pendingAmount: true }
      }),
      prisma.payment.aggregate({
        where: { schoolId },
        _sum: { amount: true }
      }),
      prisma.studentFeeAssignment.count({
        where: {
          schoolId,
          pendingAmount: { gt: new Prisma.Decimal(0) },
          feeStructure: { installments: { some: { dueDate: { lt: new Date() } } } }
        }
      }),
      prisma.studentFeeAssignment.findMany({
        where: { schoolId, pendingAmount: { gt: new Prisma.Decimal(0) } },
        include: { student: { include: { class: true } }, feeStructure: true },
        orderBy: { pendingAmount: "desc" },
        take: 10
      })
    ]);

    return {
      totalDue: toNumber(assignmentAgg._sum.totalAmount),
      totalCollected: toNumber(paymentAgg._sum.amount),
      totalPending: toNumber(assignmentAgg._sum.pendingAmount),
      overdueInstallments: overdueCount,
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

  queuePaymentReceiptWhatsApp(
    user.schoolId,
    result.assignment.student,
    data.amount,
    result.receipt.receiptNo,
    paidAt,
    toNumber(result.assignment.pendingAmount),
    result.assignment.status
  );

  return {
    payment: result.payment,
    receipt: result.receipt,
    assignment: result.assignment,
    ledger: mapAssignmentSummary(result.assignment)
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

function queuePaymentReceiptWhatsApp(
  schoolId: string,
  student: { id: string; fullName: string; parentPhone: string },
  amount: number,
  receiptNo: string,
  paidAt: Date,
  pendingAmount: number,
  status: string
) {
  const phone = student.parentPhone.trim();
  if (!phone) return;

  setTimeout(() => {
    const message = buildFeeReceiptMessage(student.fullName, amount, receiptNo, formatDate(paidAt), pendingAmount, status);
    void sendWhatsAppMessage(phone, message, {
      schoolId,
      studentId: student.id,
      kind: NotificationKind.PAYMENT_RECEIPT
    }).catch((error) => {
      logger.warn({ err: error, schoolId, studentId: student.id, receiptNo }, "Failed to send fee receipt WhatsApp notification");
    });
  }, 10_000);
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
            payments: { include: { receipt: true, installment: true }, orderBy: { paidAt: "desc" } }
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
      payments
    };
  }, { label: "getStudentLedger" });
}

export async function defaulters(schoolId: string) {
  return withRetry(async () => {
    const today = new Date();
    const assignmentsList = await prisma.studentFeeAssignment.findMany({
      where: { schoolId, pendingAmount: { gt: new Prisma.Decimal(0) } },
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

export async function getReceiptPdf(schoolId: string, receiptId: string) {
  return withRetry(async () => {
    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId, schoolId },
      include: {
        payment: {
          include: {
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

    if (!receipt) throw notFound("Receipt");

    const payment = receipt.payment;
    const student = payment.student;
    const assignment = payment.assignment;
    const feeStructure = assignment.feeStructure;

    return generateReceiptPdf({
      receiptNo: receipt.receiptNo,
      issuedAt: receipt.issuedAt,
      schoolName: receipt.school.name,
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
  }, { label: "getReceiptPdf" });
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
