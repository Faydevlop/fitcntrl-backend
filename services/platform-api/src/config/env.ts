import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  apiPrefix: process.env.API_PREFIX || "/api",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/gym_management",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "replace-with-strong-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d"
};
