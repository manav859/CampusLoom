import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

export const classTodayParamsSchema = z.object({
  classId: z.string().uuid()
});

export const studentMonthlyParamsSchema = z.object({
  studentId: z.string().uuid()
});

export const studentMonthlyQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

export const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.coerce.date(),
  notes: z.string().optional(),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.nativeEnum(AttendanceStatus),
      remarks: z.string().optional()
    })
  ).min(1)
});

export const attendanceQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});
