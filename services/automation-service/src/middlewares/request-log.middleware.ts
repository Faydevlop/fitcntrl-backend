import { NextFunction, Request, Response } from "express";
import { logger } from "../common/logger/app-logger";

export const requestLog = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on("finish", () => {
    logger.info("automation-service request completed", {
      requestId: (req as any).requestContext?.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
};
