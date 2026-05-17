import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      schoolId: string;
      tenantSchoolId?: string;
      role: UserRole;
      fullName: string;
      phone?: string;
      email?: string | null;
      schoolName?: string;
    }

    interface Request {
      user?: UserContext;
      tenant?: {
        schoolId: string;
        schoolName: string;
        dbName: string;
      };
    }
  }
}

export {};
