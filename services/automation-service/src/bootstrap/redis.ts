import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null
});

export const checkRedisReady = async (): Promise<boolean> => {
  const pong = await redis.ping();
  return pong === "PONG";
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
};
