import { NextFunction, Request, Response } from "express";
import { UserRole } from "../common/constants/enums";
import { fail } from "../common/utils/http";

const parseBearer = (headerValue?: string): string | null => {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }
  return headerValue.slice("Bearer ".length).trim() || null;
};

export const requireAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  const token = parseBearer(req.header("authorization"));
  if (!token) {
    fail(res, 401, "Authentication is required");
    return;
  }

  const roleHeader = (req.header("x-user-role") || "unknown").toLowerCase();
  const safeRole: UserRole | "unknown" =
    roleHeader === "admin" || roleHeader === "gym_owner" ? (roleHeader as UserRole) : "unknown";

  req.authContext = {
    token,
    role: safeRole,
    userId: req.header("x-user-id") || undefined
  };

  next();
};

export const allowRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.authContext?.role;
    if (!role || role === "unknown" || !roles.includes(role)) {
      fail(res, 403, "You do not have permission for this action");
      return;
    }
    next();
  };
};
