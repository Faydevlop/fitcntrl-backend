import { UserRole } from "../common/constants/enums";

declare global {
  namespace Express {
    interface Request {
      requestContext?: {
        requestId: string;
        startedAt: number;
      };
      authContext?: {
        token: string;
        role: UserRole | "unknown";
        userId?: string;
      };
    }
  }
}

export {};
