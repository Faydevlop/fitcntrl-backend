declare global {
  namespace Express {
    interface Request {
      requestContext?: {
        requestId: string;
        startedAt: number;
      };
      db: import("mongoose").Connection;
      internalAuth?: {
        token: string;
      };
      authContext?: {
        token: string;
        role: "admin" | "gym_owner" | "unknown";
        userId: string;
        gymId?: string;
      };
    }
  }
}

export { };
