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
      fail(
        res,
        400,
        "Validation failed",
        missing.map((field) => ({ field, message: `${field} is required` }))
      );
      return;
    }

    next();
  };
};

export const requireObjectIdParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if (!objectIdRegex.test(value || "")) {
      fail(res, 400, "Validation failed", [{ field: paramName, message: `${paramName} must be a valid ObjectId` }]);
      return;
    }

    next();
  };
};
