import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      schoolId: string;
      role: UserRole;
      fullName: string;
      phone?: string;
      email?: string | null;
      schoolName?: string;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};
