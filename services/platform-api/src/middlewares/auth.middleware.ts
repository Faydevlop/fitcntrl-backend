import { NextFunction, Request, Response } from "express";
import { UserRole } from "../common/constants/enums";
import { fail } from "../common/utils/http";
import { verifyAccessToken } from "../common/utils/token";

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

  const payload = verifyAccessToken(token);
  if (!payload) {
    fail(res, 401, "Invalid or expired token");
    return;
  }

  req.authContext = {
    token,
    role: payload.role as UserRole,
    userId: payload.sub,
    gymId: payload.gymId
  };

  if (payload.gymId && !req.header("x-gym-id")) {
    req.headers["x-gym-id"] = payload.gymId;
  }

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
