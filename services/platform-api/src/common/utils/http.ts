import { Request, Response } from "express";
import { applyResponseMeta } from "./response-meta";

export type ApiFieldError = {
  field: string;
  message: string;
};

const sendSuccessEnvelope = (
  req: Request,
  res: Response,
  statusCode: number,
  message: string,
  data?: unknown
): Response => {
  applyResponseMeta(req, res);
  return res.status(statusCode).json({
    meta: {
      success: true,
      message
    },
    data: data ?? null
  });
};

const sendErrorEnvelope = (
  req: Request,
  res: Response,
  statusCode: number,
  message: string,
  errors?: ApiFieldError[]
): Response => {
  applyResponseMeta(req, res);
  return res.status(statusCode).json({
    meta: {
      success: false,
      message
    },
    errors: errors ?? []
  });
};

export const ok = (res: Response, data: unknown, message = "OK"): Response => {
  return sendSuccessEnvelope(res.req, res, 200, message, data);
};

export const created = (res: Response, data: unknown, message = "Created"): Response => {
  return sendSuccessEnvelope(res.req, res, 201, message, data);
};

export const fail = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: ApiFieldError[]
): Response => {
  return sendErrorEnvelope(res.req, res, statusCode, message, errors);
};
