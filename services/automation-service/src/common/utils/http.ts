import { Response } from "express";

export const ok = (res: Response, data: unknown, message = "OK"): Response => {
  return res.status(200).json({
    success: true,
    message,
    data
  });
};

export const created = (res: Response, data: unknown, message = "Created"): Response => {
  return res.status(201).json({
    success: true,
    message,
    data
  });
};
