import { app } from "./app";
import { connectMongo, disconnectMongo } from "./bootstrap/mongo";
import { disconnectRedis } from "./bootstrap/redis";
import { env } from "./config/env";
import { verifyDependencies } from "./bootstrap/dependency-check";
import { logger } from "./common/logger/app-logger";
import { Server } from "http";

let server: Server;
const start = async (): Promise<void> => {
  await connectMongo();
  await verifyDependencies();

  server = app.listen(env.port, () => {
    logger.info("automation-service started", {
      port: env.port,
      env: env.nodeEnv
    });
  });
};

start().catch((error) => {
  logger.error("automation-service failed to start", {
    error: (error as Error).message
  });
  process.exit(1);
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info("automation-service shutdown requested", { signal });
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await Promise.allSettled([disconnectRedis(), disconnectMongo()]);
  logger.info("automation-service shutdown complete");
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
