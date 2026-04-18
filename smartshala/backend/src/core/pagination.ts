import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export function getPagination(query: unknown) {
  const parsed = paginationSchema.parse(query);
  return {
    ...parsed,
    skip: (parsed.page - 1) * parsed.limit,
    take: parsed.limit
  };
}

