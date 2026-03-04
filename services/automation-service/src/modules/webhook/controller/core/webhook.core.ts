import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { waCommandQueue, waOutboundQueue } from "../../../../bootstrap/queues";
import { WhatsAppMessageLogModel } from "../../../outbound/model/whatsapp-message-log.model";
import { WebhookEventModel } from "../../model/webhook-event.model";
import { MemberRefModel, UserRefModel } from "../../model/platform-ref.model";
import { TEMPLATE_NAMES } from "../../../../common/constants/templates";
import { resolveEncryptedOutboundLineConfig } from "../../../../common/utils/outbound-line-config";

type IncomingMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

const normalizePhone = (value?: string): string => (value || "").replace(/[^\d+]/g, "");

const toCommand = (text?: string): "hi" | "stats" | "pending" | null => {
  const normalized = (text || "").trim().toLowerCase();
  if (normalized === "hi" || normalized === "stats" || normalized === "pending") {
    return normalized;
  }
  return null;
};

const buildOwnerSummary = async (ownerPhone: string): Promise<{ gymId?: string; message: string }> => {
  const owner = await UserRefModel.findOne({
    role: "gym_owner",
    phone: { $in: [ownerPhone, ownerPhone.replace(/^\+/, ""), `+${ownerPhone.replace(/^\+/, "")}`] },
  }).lean();

  if (!owner?.gymId) {
    return { message: "We could not map this number to a gym owner account. Contact support." };
  }

  const pending = await MemberRefModel.aggregate([
    { $match: { gymId: owner.gymId, paymentStatus: "pending" } },
    { $group: { _id: null, totalCount: { $sum: 1 }, totalAmount: { $sum: "$fee" } } },
  ]);

  const totalCount = pending[0]?.totalCount || 0;
  const totalAmount = pending[0]?.totalAmount || 0;
  return {
    gymId: owner.gymId.toString(),
    message: `Pending members: ${totalCount}, Pending amount: ${totalAmount}`,
  };
};

export const webhookCore = {
  async receiveMetaWebhook(payload: unknown) {
    const input = (payload || {}) as Record<string, unknown>;
    const entries = (input.entry as Record<string, unknown>[] | undefined) || [];
    const eventId = `${String((entries[0] || {}).id || "meta")}:${String((entries[0] || {}).time || Date.now())}`;

    const webhookEvent = await WebhookEventModel.findOneAndUpdate(
      { provider: "meta", eventId },
      {
        provider: "meta",
        eventType: "messages",
        eventId,
        signatureValid: true,
        payload: input,
        status: "received",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    let processedMessages = 0;
    for (const entry of entries) {
      const changes = (entry.changes as Record<string, unknown>[] | undefined) || [];
      for (const change of changes) {
        const value = (change.value || {}) as Record<string, unknown>;
        const incomingMessages = (value.messages as IncomingMessage[] | undefined) || [];

        for (const message of incomingMessages) {
          processedMessages += 1;
          const senderPhone = normalizePhone(message.from);
          const body = message.text?.body || "";
          const command = toCommand(body);

          const inboundLog = await WhatsAppMessageLogModel.create({
            direction: "inbound",
            type: message.type || "text",
            status: "queued",
            providerMessageId: message.id || randomUUID(),
            payload: {
              from: senderPhone,
              body,
              raw: message,
            },
          });

          await waCommandQueue.add(
            "incoming-command",
            {
              from: senderPhone,
              messageText: body,
              providerMessageId: message.id || inboundLog._id.toString(),
              receivedAt: message.timestamp || new Date().toISOString(),
            },
            { jobId: `wa-command:${inboundLog._id.toString()}` },
          );

          if (command) {
            const summary = await buildOwnerSummary(senderPhone);
            const lineConfig = await resolveEncryptedOutboundLineConfig({ gymId: summary.gymId });
            if (!lineConfig) {
              await WhatsAppMessageLogModel.create({
                gymId:
                  summary.gymId && Types.ObjectId.isValid(summary.gymId)
                    ? new Types.ObjectId(summary.gymId)
                    : undefined,
                direction: "outbound",
                type: "command_response",
                status: "failed",
                templateName: TEMPLATE_NAMES.OWNER_COMMAND_RESPONSE,
                error: "No active WhatsApp sender line configured.",
                payload: {
                  to: senderPhone,
                  messageType: "text",
                  templateName: TEMPLATE_NAMES.OWNER_COMMAND_RESPONSE,
                  variables: {
                    command,
                    summary: summary.message,
                  },
                },
              });
              continue;
            }

            const outboundPayload = {
              to: senderPhone,
              messageType: "text",
              templateName: TEMPLATE_NAMES.OWNER_COMMAND_RESPONSE,
              variables: {
                command,
                summary: summary.message,
              },
              lineConfig,
            };

            const outboundLog = await WhatsAppMessageLogModel.create({
              gymId:
                summary.gymId && Types.ObjectId.isValid(summary.gymId)
                  ? new Types.ObjectId(summary.gymId)
                  : undefined,
              direction: "outbound",
              type: "command_response",
              status: "queued",
              templateName: TEMPLATE_NAMES.OWNER_COMMAND_RESPONSE,
              payload: outboundPayload,
            });

            await waOutboundQueue.add("send-message", {
              ...outboundPayload,
              messageLogId: outboundLog._id.toString(),
            });
          }
        }
      }
    }

    webhookEvent.status = "processed";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();

    return {
      eventId,
      processedMessages,
    };
  },
  verifyMetaToken(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
    expectedToken: string,
  ) {
    if (mode !== "subscribe" || token !== expectedToken) {
      return null;
    }
    return challenge || "verified";
  },
};
