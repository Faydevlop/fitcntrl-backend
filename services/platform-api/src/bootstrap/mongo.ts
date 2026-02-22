import mongoose from "mongoose";
import { env } from "../config/env";

export const connectMongo = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri);
};
