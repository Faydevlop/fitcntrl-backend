import { Queue } from "bullmq";
import { env } from "../config/env";

const prefix = "gymflow";
const redisUrl = new URL(env.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379)
};

export const waOutboundQueue = new Queue("wa.outbound", { connection, prefix });
export const waReminderQueue = new Queue("wa.reminder", { connection, prefix });
export const waReportQueue = new Queue("wa.report", { connection, prefix });
export const auditEventsQueue = new Queue("audit.events", { connection, prefix });
