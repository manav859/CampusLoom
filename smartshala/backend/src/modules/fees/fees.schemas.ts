import { FeeFrequency, PaymentMode } from "@prisma/client";
import { z } from "zod";

export const feeStructureSchema = z.object({
  classId: z.string().uuid().optional(),
  name: z.string().min(2),
  academicYear: z.string().min(4),
  frequency: z.nativeEnum(FeeFrequency),
  totalAmount: z.coerce.number().positive(),
  installments: z.array(
    z.object({
      name: z.string().min(2),
      dueDate: z.coerce.date(),
      amount: z.coerce.number().positive(),
      sortOrder: z.coerce.number().int().default(0)
    })
  ).min(1)
});

export const assignFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid()
});

export const paymentSchema = z.object({
  assignmentId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  paidAt: z.coerce.date().optional(),
  notes: z.string().optional()
});

