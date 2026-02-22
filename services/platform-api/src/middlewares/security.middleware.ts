import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { fail } from "../common/utils/http";

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }

  if (env.nodeEnv === "development" && env.corsAllowlist.length === 0) {
    return true;
  }

  return env.corsAllowlist.includes(origin);
};

export const corsGate = (req: Request, res: Response, next: NextFunction): void => {
  const requestOrigin = req.headers.origin;

  if (!isOriginAllowed(requestOrigin)) {
    fail(res, 403, "Origin is not allowed");
    return;
  }

  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  } else if (env.nodeEnv === "development" && env.corsAllowlist.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-User-Role,X-Request-Id");

  if (req.method.toUpperCase() === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
};

export const applySecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  next();
};
