import { z } from "zod";

export const createAcademicYearSchema = z.object({
  name: z.string().trim().min(4),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
});

export const rolloverPreviewSchema = z.object({
  targetName: z.string().trim().min(4).optional()
});

const rolloverMappingSchema = z
  .object({
    sourceClassId: z.string().uuid(),
    action: z.enum(["PROMOTE", "GRADUATE"]),
    targetName: z.string().trim().min(1).optional(),
    targetSection: z.string().trim().min(1).optional(),
    classTeacherId: z.string().uuid().nullable().optional(),
    heldBackStudentIds: z.array(z.string().uuid()).optional()
  })
  .refine((mapping) => mapping.action === "GRADUATE" || (Boolean(mapping.targetName) && Boolean(mapping.targetSection)), {
    message: "targetName and targetSection are required when promoting"
  });

export const rolloverCommitSchema = z.object({
  targetYear: z.object({
    name: z.string().trim().min(4),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  }),
  mappings: z.array(rolloverMappingSchema).min(1),
  setCurrent: z.boolean().default(true)
});

export type RolloverCommitInput = z.infer<typeof rolloverCommitSchema>;
