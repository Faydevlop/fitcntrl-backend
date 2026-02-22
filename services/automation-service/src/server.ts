import { app } from "./app";
import { connectMongo } from "./bootstrap/mongo";
import { env } from "./config/env";

const start = async (): Promise<void> => {
  await connectMongo();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`automation-service running on port ${env.port}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("automation-service failed to start", error);
  process.exit(1);
});
