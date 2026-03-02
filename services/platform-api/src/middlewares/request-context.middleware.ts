import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import mongoose, { Connection } from "mongoose";
import { env } from "../config/env";
import { logger } from "../common/logger/app-logger";
import { registerAuthModels } from "../modules/auth/model/index";

const connections: Record<string, Connection> = {};

const getDBConnection = (uri: string): Connection => {
  if (!connections[uri]) {
    connections[uri] = mongoose.createConnection(uri);
    registerAuthModels(connections[uri]);
    connections[uri].on("connected", () => logger.info("MongoDB connected", { uri: uri.replace(/\/\/.*@/, "//***@") }));
    connections[uri].on("error", (err) => logger.error("MongoDB connection error", { uri: uri.replace(/\/\/.*@/, "//***@"), error: err.message }));
  }
  return connections[uri];
};

export const attachRequestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.header("x-request-id") || randomUUID()).trim();
  const startedAt = Date.now();

  const isDemo = req.header("x-demodb") === "true";
  const mongoUri = isDemo ? env.mongoDemoUri : env.mongoUri;

  req.requestContext = {
    requestId, startedAt
  };
  req.db = getDBConnection(mongoUri);

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-demodb-active", String(isDemo));

  next();
};
