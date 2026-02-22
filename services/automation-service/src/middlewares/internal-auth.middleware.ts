import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { fail } from "../common/utils/http";

const parseBearer = (headerValue?: string): string | null => {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }
  return headerValue.slice("Bearer ".length).trim() || null;
};

export const requireInternalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalToken = req.header("x-internal-token") || parseBearer(req.header("authorization"));
  if (!internalToken || internalToken !== env.internalApiToken) {
    fail(res, 401, "Internal authorization failed");
    return;
  }

  req.internalAuth = { token: internalToken };
  next();
};
