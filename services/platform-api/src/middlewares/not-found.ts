import { Request, Response } from "express";
import { fail } from "../common/utils/http";

export const notFoundHandler = (req: Request, res: Response): void => {
  fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};
