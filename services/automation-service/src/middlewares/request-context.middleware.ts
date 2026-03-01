import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export const attachRequestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.header("x-request-id") || randomUUID()).trim();
  req.requestContext = {
    requestId,
    startedAt: Date.now(),
  };
  res.setHeader("x-request-id", requestId);
  next();
};
