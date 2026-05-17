import { z } from "zod";

export const registerExistingTenantSchema = z.object({
  schoolId: z.string().trim().regex(/^[A-Z0-9]{8}$/),
  schoolName: z.string().trim().min(2).max(160).default("SmartShala Demo School"),
  ownerName: z.string().trim().min(2).max(120).default("Principal"),
  email: z.string().trim().email().default("principal@smartshala.local"),
  phone: z.string().trim().min(10).max(20).default("9876504001"),
  address: z.string().trim().min(5).max(500).default("Ahmedabad"),
  numberOfStudents: z.coerce.number().int().min(1).max(10000).default(720),
  numberOfStaff: z.coerce.number().int().min(1).max(1000).default(30),
  dbName: z.string().trim().min(2).max(80).default("smartshala")
});
