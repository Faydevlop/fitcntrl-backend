declare global {
  namespace Express {
    interface Request {
      requestContext?: {
        requestId: string;
        startedAt: number;
      };
      internalAuth?: {
        token: string;
      };
    }
  }
}

export {};
