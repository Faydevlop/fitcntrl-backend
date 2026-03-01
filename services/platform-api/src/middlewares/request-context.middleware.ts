import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export const attachRequestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.header("x-request-id") || randomUUID()).trim();
  const startedAt = Date.now();

  (req as any).requestContext = { requestId, startedAt };
  res.setHeader("x-request-id", requestId);

  next();
};
