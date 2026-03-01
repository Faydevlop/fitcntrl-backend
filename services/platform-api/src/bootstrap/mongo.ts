import mongoose from "mongoose";
import dns from "dns";
import { env } from "../config/env";
import { logger } from "../common/logger/app-logger";

if (env.mongoDnsServers.length > 0) {
  dns.setServers(env.mongoDnsServers);
}

export const connectMongo = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri);
  logger.info("MongoDB connected successfully", { uri: env.mongoUri.replace(/\/\/.*@/, "//***@") });
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};

export const isMongoReady = (): boolean => mongoose.connection.readyState === 1;
