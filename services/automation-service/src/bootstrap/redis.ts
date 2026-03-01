import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../common/logger/app-logger";

export const redis = new Redis({
  host: env.redisHost,
  port: env.redisPort,
  username: env.redisUsername,
  password: env.redisPassword,
  ...(env.redisTls ? { tls: {} } : {}),
  maxRetriesPerRequest: null
});

redis.on("connect", () => {
  logger.info("Redis connected successfully", { host: env.redisHost, port: env.redisPort });
});

redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
});

export const checkRedisReady = async (): Promise<boolean> => {
  const pong = await redis.ping();
  return pong === "PONG";
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
};
