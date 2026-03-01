import { Request, Response } from "express";
import { env } from "../../config/env";

export const applyResponseMeta = (req: Request, res: Response): void => {
  const requestId = req.requestContext?.requestId || "n/a";
  const elapsedMs = req.requestContext?.startedAt ? Date.now() - req.requestContext.startedAt : 0;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-environment", env.nodeEnv);
  res.setHeader("x-response-time", `${elapsedMs}ms`);
};
