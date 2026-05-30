import { FeeAdjustmentType, FeeFrequency, PaymentMode, FeeComponent } from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

export const feeStructureSchema = z.object({
  classId: z.string().uuid().optional(),
  name: z.string().trim().min(2).optional(),
  term: z.string().trim().min(1).optional(),
  academicYear: z.string().trim().min(4).optional(),
  frequency: z.nativeEnum(FeeFrequency).optional(),
  totalAmount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01),
  dueDate: z.coerce.date().optional(),
  installments: z.array(
    z.object({
      name: z.string().trim().min(2),
      dueDate: z.coerce.date(),
      amount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01),
      sortOrder: z.coerce.number().int().default(0)
    })
  ).min(1).optional()
}).superRefine((data, ctx) => {
  if (!data.name && !data.term) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["term"], message: "Either term or name is required" });
  }

  if (!data.installments && !data.dueDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Either dueDate or installments is required" });
  }
});

export const feeStructureUpdateSchema = z.object({
  classId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).optional(),
  academicYear: z.string().trim().min(4).optional(),
  frequency: z.nativeEnum(FeeFrequency).optional(),
  totalAmount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01).optional(),
  installments: z.array(
    z.object({
      name: z.string().trim().min(2),
      dueDate: z.coerce.date(),
      amount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01),
      sortOrder: z.coerce.number().int().default(0)
    })
  ).min(1).optional(),
  isActive: z.coerce.boolean().optional()
});

export const assignFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid()
});

export const assignClassFeeSchema = z.object({
  feeStructureId: z.string().uuid()
});

export const paymentSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  installmentId: z.string().uuid().optional(),
  amount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01),
  feeComponent: z.preprocess((value) => (typeof value === "string" ? value.toUpperCase() : value), z.nativeEnum(FeeComponent)).optional().default(FeeComponent.SCHOOL_FEE),
  mode: z.preprocess((value) => (typeof value === "string" ? value.toUpperCase() : value), z.nativeEnum(PaymentMode)),
  paidAt: z.coerce.date().optional(),
  upiTransactionId: optionalTrimmed,
  chequeNumber: optionalTrimmed,
  ddNumber: optionalTrimmed,
  gatewayTransactionId: optionalTrimmed,
  bankReference: optionalTrimmed,
  sendReceiptOnWhatsApp: z.coerce.boolean().optional().default(true),
  notes: z.string().trim().optional()
}).superRefine((data, ctx) => {
  if (!data.assignmentId && !data.studentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "Either studentId or assignmentId is required" });
  }

  const requiredReferences: Partial<Record<PaymentMode, keyof typeof data>> = {
    [PaymentMode.UPI]: "upiTransactionId",
    [PaymentMode.CHEQUE]: "chequeNumber",
    [PaymentMode.DD]: "ddNumber",
    [PaymentMode.BANK_TRANSFER]: "bankReference",
    [PaymentMode.ONLINE_GATEWAY]: "gatewayTransactionId"
  };
  const referenceLabels: Partial<Record<keyof typeof data, string>> = {
    upiTransactionId: "UPI transaction ID",
    chequeNumber: "Cheque number",
    ddNumber: "DD number",
    bankReference: "Bank reference",
    gatewayTransactionId: "Gateway transaction ID"
  };
  const requiredField = requiredReferences[data.mode];

  if (requiredField && !data[requiredField]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [requiredField],
      message: `${referenceLabels[requiredField]} is required for ${data.mode.toLowerCase().replace(/_/g, " ")} payments`
    });
  }
});

export const feeAdjustmentSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  type: z.nativeEnum(FeeAdjustmentType),
  amount: z.coerce.number().positive().finite().max(10_000_000).multipleOf(0.01),
  reason: z.string().trim().min(3).max(500)
}).superRefine((data, ctx) => {
  if (!data.assignmentId && !data.studentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "Either studentId or assignmentId is required" });
  }
});
