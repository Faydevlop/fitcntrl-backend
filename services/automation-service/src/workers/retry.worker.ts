import { Worker } from "bullmq";
import { WhatsAppMessageLogModel } from "../modules/outbound/model/whatsapp-message-log.model";
import { queueConnection } from "../common/utils/queue-connection";

export const startRetryWorker = (): Worker => {
  return new Worker(
    "wa.retry",
    async job => {
      const messageLogId = job.data?.messageLogId as string | undefined;
      const errorMessage = String(job.data?.error || "retry failed");
      if (messageLogId) {
        await WhatsAppMessageLogModel.findByIdAndUpdate(messageLogId, {
          $set: { status: "failed", error: errorMessage },
        });
      }
      return { processed: true };
    },
    { connection: queueConnection, prefix: "gymflow" },
  );
};
