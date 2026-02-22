import { checkRedisReady } from "./redis";

export const verifyDependencies = async (): Promise<void> => {
  const redisReady = await checkRedisReady();
  if (!redisReady) {
    throw new Error("Redis is not ready");
  }
};
