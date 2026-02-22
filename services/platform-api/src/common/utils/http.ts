import { Request, Response } from "express";
import { applyResponseMeta } from "./response-meta";

const sendEnvelope = (
  req: Request,
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: unknown
): Response => {
  applyResponseMeta(req, res);
  return res.status(statusCode).json({
    success,
    message,
    data: data ?? null
  });
};

export const ok = (res: Response, data: unknown, message = "OK"): Response => {
  return sendEnvelope(res.req, res, 200, true, message, data);
};

export const created = (res: Response, data: unknown, message = "Created"): Response => {
  return sendEnvelope(res.req, res, 201, true, message, data);
};

export const fail = (res: Response, statusCode: number, message: string, data?: unknown): Response => {
  applyResponseMeta(res.req, res);
  return res.status(statusCode).json({
    success: false,
    message,
    data: data ?? null
  });
};
