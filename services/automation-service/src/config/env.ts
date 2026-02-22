import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4001),
  apiPrefix: process.env.API_PREFIX || "/api",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/gym_management",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "replace_verify_token"
};
