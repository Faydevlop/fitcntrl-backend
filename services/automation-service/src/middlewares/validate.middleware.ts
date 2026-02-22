import { NextFunction, Request, Response } from "express";
import { fail } from "../common/utils/http";

export const requireBodyKeys = (...keys: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body || {};
    const missing = keys.filter((key) => {
      const value = body[key];
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      fail(res, 400, `Missing required fields: ${missing.join(", ")}`);
      return;
    }

    next();
  };
};
