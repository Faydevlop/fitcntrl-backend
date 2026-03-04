import { app } from "./app";
import { connectMongo, disconnectMongo } from "./bootstrap/mongo";
import { disconnectRedis } from "./bootstrap/redis";
import { env } from "./config/env";
import { verifyDependencies } from "./bootstrap/dependency-check";
import { logger } from "./common/logger/app-logger";
import { Server } from "http";
import { seedAdmin } from "./seeds/admin.seed";
import { seedBasicPlan } from "./seeds/basic-plan.seed";
import { startBackupScheduler, stopBackupScheduler } from "./bootstrap/backup-scheduler";

let server: Server;
const start = async (): Promise<void> => {
  await connectMongo();
  await verifyDependencies();
  await seedAdmin();
  await seedBasicPlan();
  startBackupScheduler();

  server = app.listen(env.port, () => {
    logger.info("platform-api started", {
      port: env.port,
      env: env.nodeEnv,
    });
  });
};

start().catch(error => {
  logger.error("platform-api failed to start", {
    error: (error as Error).message,
  });
  process.exit(1);
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info("platform-api shutdown requested", { signal });

  // Force exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    logger.warn("platform-api graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }

    stopBackupScheduler();

    await Promise.allSettled([disconnectRedis(), disconnectMongo()]);
    logger.info("platform-api shutdown complete");
  } catch {
    logger.error("platform-api shutdown error");
  }

  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
