import { NextFunction, Request, Response } from "express";
import { fail } from "../common/utils/http";

type Entry = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, Entry>();

export const createIpThrottle = (windowMs: number, maxRequests: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      fail(res, 429, "Too many requests");
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
};
