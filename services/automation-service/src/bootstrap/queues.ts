import { Queue } from "bullmq";
import { queueConnection } from "../common/utils/queue-connection";

const prefix = "gymflow";

export const waOutboundQueue = new Queue("wa.outbound", { connection: queueConnection, prefix });
export const waReminderQueue = new Queue("wa.reminder", { connection: queueConnection, prefix });
export const waReportQueue = new Queue("wa.report", { connection: queueConnection, prefix });
export const waCommandQueue = new Queue("wa.command", { connection: queueConnection, prefix });
export const waRetryQueue = new Queue("wa.retry", { connection: queueConnection, prefix });
