import { z } from "zod";

export const announcementAudiences = ["ALL", "STAFF", "TEACHERS", "PARENTS"] as const;
export const announcementPriorities = ["NORMAL", "IMPORTANT", "URGENT"] as const;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title").max(150),
  body: z.string().trim().min(5, "Write the announcement body").max(4000),
  audience: z.enum(announcementAudiences).default("ALL"),
  priority: z.enum(announcementPriorities).default("NORMAL")
});

export const announcementListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
