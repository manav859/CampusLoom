import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      schoolId: string;
      role: UserRole;
      fullName: string;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};

