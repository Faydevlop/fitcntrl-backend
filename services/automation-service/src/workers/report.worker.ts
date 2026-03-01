import { Worker } from "bullmq";
import { WhatsAppMessageLogModel } from "../modules/outbound/model/whatsapp-message-log.model";
import { queueConnection } from "../common/utils/queue-connection";

export const startReportWorker = (): Worker => {
  return new Worker(
    "wa.report",
    async job => {
      const messageLogId = job.data?.messageLogId as string | undefined;
      if (messageLogId) {
        await WhatsAppMessageLogModel.findByIdAndUpdate(messageLogId, {
          $set: {
            status: "sent",
            sentAt: new Date(),
          },
        });
      }
      return { processed: true };
    },
    { connection: queueConnection, prefix: "gymflow" },
  );
};
