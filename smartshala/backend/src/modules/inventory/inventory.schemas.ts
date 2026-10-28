import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalPhone = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Use a 10-digit phone number")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const idParamsSchema = z.object({ id: z.string().uuid() });

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Give the category a name").max(60)
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "Give the vendor a name").max(120),
  phone: optionalPhone,
  email: z.string().trim().email("Enter a valid email").max(120).optional().nullable().or(z.literal("").transform(() => null)),
  gstin: optionalText(20),
  address: optionalText(300),
  notes: optionalText(500)
});

export const itemSchema = z.object({
  name: z.string().trim().min(2, "Give the item a name").max(120),
  categoryId: z.string().uuid().optional().nullable(),
  sku: optionalText(40),
  type: z.enum(["CONSUMABLE", "ASSET"]).default("CONSUMABLE"),
  unit: z.string().trim().min(1, "Set a unit").max(20).default("unit"),
  reorderLevel: z.coerce.number().int("Reorder level is a whole number").min(0).max(1_000_000).default(0),
  location: optionalText(120),
  notes: optionalText(500),
  isActive: z.boolean().optional(),
  // Optional starting stock, recorded as an opening ADJUSTMENT on create. Ignored on update.
  openingQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  openingUnitCost: z.coerce.number().min(0).max(100_000_000).optional().nullable()
});

/**
 * One stock movement. PURCHASE and ISSUE carry a positive `quantity`;
 * ADJUSTMENT carries a signed, non-zero `quantityDelta` and a reason. The
 * service re-checks these, but validating here gives the client clean errors.
 */
export const transactionSchema = z
  .object({
    type: z.enum(["PURCHASE", "ISSUE", "ADJUSTMENT"]),
    quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
    quantityDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional(),
    unitCost: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
    totalCost: z.coerce.number().min(0).max(1_000_000_000).optional().nullable(),
    vendorId: z.string().uuid().optional().nullable(),
    invoiceNumber: optionalText(60),
    issuedTo: optionalText(120),
    reason: optionalText(200),
    note: optionalText(500),
    occurredAt: z.coerce.date().optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "ADJUSTMENT") {
      if (!value.quantityDelta || value.quantityDelta === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantityDelta"], message: "Enter a non-zero adjustment" });
      }
      if (!value.reason) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Give a reason for the adjustment" });
      }
    } else if (!value.quantity || value.quantity < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Enter a quantity of at least 1" });
    }
  });

export const itemsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(["CONSUMABLE", "ASSET"]).optional(),
  lowStock: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
});

export const transactionsQuerySchema = z.object({
  type: z.enum(["PURCHASE", "ISSUE", "ADJUSTMENT"]).optional(),
  itemId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});
