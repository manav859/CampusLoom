import { FeeFrequency, PaymentMode } from "@prisma/client";
import { z } from "zod";

export const feeStructureSchema = z.object({
  classId: z.string().uuid().optional(),
  name: z.string().trim().min(2).optional(),
  term: z.string().trim().min(1).optional(),
  academicYear: z.string().trim().min(4).optional(),
  frequency: z.nativeEnum(FeeFrequency).optional(),
  totalAmount: z.coerce.number().positive(),
  dueDate: z.coerce.date().optional(),
  installments: z.array(
    z.object({
      name: z.string().trim().min(2),
      dueDate: z.coerce.date(),
      amount: z.coerce.number().positive(),
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
  amount: z.coerce.number().positive(),
  mode: z.preprocess((value) => (typeof value === "string" ? value.toUpperCase() : value), z.nativeEnum(PaymentMode)),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().optional()
}).superRefine((data, ctx) => {
  if (!data.assignmentId && !data.studentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "Either studentId or assignmentId is required" });
  }
});
