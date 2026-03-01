import { Worker } from "bullmq";
import { queueConnection } from "../common/utils/queue-connection";

export const startCommandWorker = (): Worker => {
  return new Worker(
    "wa.command",
    async job => {
      return {
        processed: true,
        from: job.data?.from || null,
      };
    },
    { connection: queueConnection, prefix: "gymflow" },
  );
};
