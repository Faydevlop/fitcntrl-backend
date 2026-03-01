import { NextFunction, Request, Response } from "express";
import { fail } from "../common/utils/http";
import { logger } from "../common/logger/app-logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error("Unhandled platform-api error", {
    requestId: (req as any).requestContext?.requestId,
    message: err.message
  });
  fail(res, 500, err.message || "Internal server error");
};
