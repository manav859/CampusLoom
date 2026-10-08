import { z } from "zod";

/** Blank form fields arrive as "" — store them as nothing, not as an empty string. */
const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const optionalText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalCount = z.preprocess(blankToNull, z.coerce.number().int().min(0).max(100000).nullable().optional());

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const leadFields = {
  schoolName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(10).max(20),
  address: optionalText(500),
  gstin: z.preprocess(
    (value) => (typeof value === "string" ? blankToNull(value.toUpperCase()) : value),
    z.string().trim().regex(GSTIN, "Enter a valid 15-character GSTIN").nullable().optional()
  ),
  stateName: optionalText(60),
  stateCode: z.preprocess(blankToNull, z.string().regex(/^\d{2}$/).nullable().optional()),
  numberOfStudents: optionalCount,
  numberOfStaff: optionalCount
};

const stage = z.enum(["NEW", "CONTACTED", "PROFORMA_SENT", "PAID", "ONBOARDED", "LOST"]);
const role = z.enum(["ADMIN", "SALES"]);
const password = z.string().min(8).max(72);

export const crmLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200)
});

export const createLeadSchema = z.object({
  ...leadFields,
  assignedToId: z.preprocess(blankToNull, z.string().uuid().nullable().optional())
});

export const updateLeadSchema = z.object({
  ...Object.fromEntries(Object.entries(leadFields).map(([key, schema]) => [key, schema.optional()])),
  stage: stage.optional(),
  lostReason: optionalText(300),
  assignedToId: z.preprocess(blankToNull, z.string().uuid().nullable().optional())
}) as z.ZodType<Partial<z.infer<typeof createLeadSchema>> & { stage?: z.infer<typeof stage>; lostReason?: string | null }>;

export const leadListQuerySchema = z.object({
  stage: stage.optional(),
  q: z.string().trim().max(100).optional(),
  assignedTo: z.string().trim().max(40).optional()
});

export const noteSchema = z.object({ text: z.string().trim().min(1).max(4000) });

export const proformaSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
  priceRupees: z.coerce.number().positive().max(10_000_000).optional(),
  couponCode: z.preprocess(blankToNull, z.string().trim().max(40).optional().nullable()).transform((value) => value ?? undefined),
  validDays: z.coerce.number().int().min(1).max(90).optional(),
  notes: z.string().trim().max(500).optional()
});

export const paymentLinkSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
  note: z.string().trim().max(300).optional()
});

export const paymentsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  q: z.string().trim().max(100).optional()
});

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  role,
  password
});

export const updateTeamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.preprocess(blankToNull, z.string().trim().max(20).nullable().optional()),
  role: role.optional(),
  isActive: z.boolean().optional(),
  password: password.optional()
});

export const leadIdParamSchema = z.object({ leadId: z.string().uuid() });
export const proformaIdParamSchema = z.object({ proformaId: z.string().uuid() });
export const linkIdParamSchema = z.object({ linkId: z.string().uuid() });
export const userIdParamSchema = z.object({ userId: z.string().uuid() });
export const invoiceIdParamSchema = z.object({ invoiceId: z.string().uuid() });

export const metaConnectSchema = z.object({
  pageId: z.string().trim().regex(/^\d{5,25}$/, "Enter the numeric Page ID"),
  accessToken: z.string().trim().min(20).max(1000)
});

export const metaFormsSchema = z.object({
  formIds: z.array(z.string().trim().regex(/^\d{5,25}$/)).max(200)
});
