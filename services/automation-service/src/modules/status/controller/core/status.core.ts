import { isMongoReady } from "../../../../bootstrap/mongo";
import { checkRedisReady } from "../../../../bootstrap/redis";

export const statusCore = {
  async health() {
    const redisReady = await checkRedisReady();
    const mongoReady = isMongoReady();
    return {
      service: "automation-service",
      status: redisReady && mongoReady ? "ok" : "degraded",
      checks: {
        mongo: mongoReady,
        redis: redisReady,
      },
    };
  },
};
