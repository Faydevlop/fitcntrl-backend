import { logger } from "../common/logger/app-logger";
import { checkRedisReady } from "./redis";
import { isMailerConfigured, verifyMailerConnection } from "../config/mailer";

export const verifyDependencies = async (): Promise<void> => {
  const redisReady = await checkRedisReady();
  if (!redisReady) {
    throw new Error("Redis is not ready");
  }

  if (isMailerConfigured()) {
    await verifyMailerConnection();
    logger.info("SMTP transport verified");
  } else {
    logger.warn("SMTP transport not configured; OTP email sending will fail until configured");
  }
};
