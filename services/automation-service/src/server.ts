import { app } from "./app";
import { connectMongo, disconnectMongo } from "./bootstrap/mongo";
import { disconnectRedis } from "./bootstrap/redis";
import { env } from "./config/env";
import { verifyDependencies } from "./bootstrap/dependency-check";
import { logger } from "./common/logger/app-logger";
import { Server } from "http";
import { startReminderWorker } from "./workers/reminder.worker";
import { startReportWorker } from "./workers/report.worker";
import { startCommandWorker } from "./workers/command.worker";
import { startRetryWorker } from "./workers/retry.worker";
import { startOutboundWorker } from "./workers/outbound.worker";
import { Worker } from "bullmq";

let server: Server;
let workers: Worker[] = [];
const start = async (): Promise<void> => {
  await connectMongo();
  await verifyDependencies();
  workers = [
    startReminderWorker(),
    startReportWorker(),
    startCommandWorker(),
    startRetryWorker(),
    startOutboundWorker()
  ];

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

  // Force exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    logger.warn("automation-service graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await Promise.allSettled([...workers.map((worker) => worker.close()), disconnectRedis(), disconnectMongo()]);
    logger.info("automation-service shutdown complete");
  } catch {
    logger.error("automation-service shutdown error");
  }

  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
