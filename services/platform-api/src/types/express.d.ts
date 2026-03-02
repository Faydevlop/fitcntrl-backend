import { UserRole } from "../common/constants/enums";

declare global {
  namespace Express {
    interface Request {
      requestContext?: {
        requestId: string;
        startedAt: number;
      };
      db: import("mongoose").Connection;
      authContext?: {
        token: string;
        role: UserRole | "unknown";
        userId?: string;
        gymId?: string;
      };
    }
  }
}

export { };
