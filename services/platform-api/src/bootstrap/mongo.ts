import mongoose from "mongoose";
import dns from "dns";
import { env } from "../config/env";

if (env.mongoDnsServers.length > 0) {
  dns.setServers(env.mongoDnsServers);
}

export const connectMongo = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri);
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};

export const isMongoReady = (): boolean => mongoose.connection.readyState === 1;
