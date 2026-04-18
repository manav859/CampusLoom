import { InstallmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function receiptNo() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replaceAll("-", "");
  return `SS-${datePart}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function dashboard(schoolId: string) {
  const [assignmentAgg, paymentAgg, overdueCount, defaulters] = await Promise.all([
    prisma.studentFeeAssignment.aggregate({
      where: { schoolId },
      _sum: { totalAmount: true, paidAmount: true, pendingAmount: true }
    }),
    prisma.payment.aggregate({
      where: { schoolId },
      _sum: { amount: true }
    }),
    prisma.studentFeeAssignment.count({
      where: { schoolId, pendingAmount: { gt: new Prisma.Decimal(0) }, feeStructure: { installments: { some: { dueDate: { lt: new Date() } } } } }
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
    topDefaulters: defaulters
  };
}

export async function createFeeStructure(
  schoolId: string,
  data: {
    classId?: string;
    name: string;
    academicYear: string;
    frequency: "ANNUAL" | "QUARTERLY" | "MONTHLY" | "CUSTOM";
    totalAmount: number;
    installments: { name: string; dueDate: Date; amount: number; sortOrder: number }[];
  }
) {
  if (data.classId) {
    const classRecord = await prisma.class.findFirst({ where: { id: data.classId, schoolId } });
    if (!classRecord) throw notFound("Class");
  }
  const installmentTotal = data.installments.reduce((sum, installment) => sum + installment.amount, 0);
  if (Math.round(installmentTotal * 100) !== Math.round(data.totalAmount * 100)) {
    throw new AppError(400, "Installment total must equal total fee amount", "INVALID_INSTALLMENT_TOTAL");
  }

  return prisma.feeStructure.create({
    data: {
      schoolId,
      classId: data.classId,
      name: data.name,
      academicYear: data.academicYear,
      frequency: data.frequency,
      totalAmount: data.totalAmount,
      installments: {
        create: data.installments.map((installment) => ({
          name: installment.name,
          dueDate: installment.dueDate,
          amount: installment.amount,
          sortOrder: installment.sortOrder
        }))
      }
    },
    include: { installments: true }
  });
}

export async function listFeeStructures(schoolId: string) {
  return prisma.feeStructure.findMany({
    where: { schoolId },
    include: { class: true, installments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function assignFee(schoolId: string, studentId: string, feeStructureId: string) {
  const [student, feeStructure] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, schoolId } }),
    prisma.feeStructure.findFirst({ where: { id: feeStructureId, schoolId } })
  ]);
  if (!student) throw notFound("Student");
  if (!feeStructure) throw notFound("Fee structure");

  return prisma.studentFeeAssignment.create({
    data: {
      schoolId,
      studentId,
      feeStructureId,
      totalAmount: feeStructure.totalAmount,
      pendingAmount: feeStructure.totalAmount
    },
    include: { student: true, feeStructure: true }
  });
}

export async function collectPayment(
  user: Express.UserContext,
  data: { assignmentId: string; installmentId?: string; amount: number; mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER"; paidAt?: Date; notes?: string }
) {
  const assignment = await prisma.studentFeeAssignment.findFirst({
    where: { id: data.assignmentId, schoolId: user.schoolId },
    include: { student: true }
  });
  if (!assignment) throw notFound("Fee assignment");
  if (data.amount > toNumber(assignment.pendingAmount)) {
    throw new AppError(400, "Payment exceeds pending amount", "PAYMENT_EXCEEDS_BALANCE");
  }

  const paidAmount = toNumber(assignment.paidAmount) + data.amount;
  const pendingAmount = toNumber(assignment.pendingAmount) - data.amount;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        studentId: assignment.studentId,
        assignmentId: assignment.id,
        installmentId: data.installmentId,
        amount: data.amount,
        mode: data.mode,
        paidAt: data.paidAt ?? new Date(),
        notes: data.notes,
        recordedById: user.id
      }
    });

    await tx.studentFeeAssignment.update({
      where: { id: assignment.id },
      data: {
        paidAmount,
        pendingAmount,
        status: pendingAmount === 0 ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL
      }
    });

    const receipt = await tx.receipt.create({
      data: {
        schoolId: user.schoolId,
        paymentId: payment.id,
        receiptNo: receiptNo()
      }
    });

    return { payment, receipt };
  });
}

export async function getStudentLedger(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      class: true,
      feeAssignments: {
        include: {
          feeStructure: { include: { installments: { orderBy: { sortOrder: "asc" } } } },
          payments: { include: { receipt: true, installment: true }, orderBy: { paidAt: "desc" } }
        }
      }
    }
  });
  if (!student) throw notFound("Student");
  return student;
}

export async function defaulters(schoolId: string) {
  return prisma.studentFeeAssignment.findMany({
    where: { schoolId, pendingAmount: { gt: new Prisma.Decimal(0) } },
    include: { student: { include: { class: true } }, feeStructure: true },
    orderBy: { pendingAmount: "desc" }
  });
}

