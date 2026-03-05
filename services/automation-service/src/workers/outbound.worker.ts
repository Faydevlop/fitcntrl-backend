import { Worker } from "bullmq";
import { WhatsAppMessageLogModel } from "../modules/outbound/model/whatsapp-message-log.model";
import { queueConnection } from "../common/utils/queue-connection";
import { env } from "../config/env";
import { getTemplateConfig } from "../common/constants/template-registry";
import { decryptFieldValue } from "../common/utils/field-crypto";
import { logger } from "../common/logger/app-logger";
import {
  readProviderMessageId,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
} from "../common/utils/whatsapp-graph";

type OutboundJobData = {
  to?: string;
  messageType?: string;
  message?: string;
  templateName?: string;
  language?: string;
  variables?: Record<string, unknown>;
  templateVariables?: unknown[];
  lineConfig?: {
    phone?: string;
    phoneNumberIdEncrypted?: string;
    wabaIdEncrypted?: string;
    tokenEncrypted?: string;
  };
  followUp?: {
    messageType?: "text";
    message?: string;
  };
  messageLogId?: string;
};

const normalizePhone = (value: string): string => value.replace(/[^\d]/g, "");

const replaceTokens = (template: string, variables: Record<string, unknown>): string => {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, token) => {
    const key = String(token || "").trim();
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
};

const resolveGraphConfig = (jobData: OutboundJobData) => {
  const encryptedPhoneNumberId = String(
    jobData.lineConfig?.phoneNumberIdEncrypted || "",
  ).trim();
  const encryptedAccessToken = String(
    jobData.lineConfig?.tokenEncrypted || "",
  ).trim();

  if (!encryptedPhoneNumberId || !encryptedAccessToken) {
    throw new Error("Missing encrypted WhatsApp sender configuration in queue payload.");
  }

  const phoneNumberId = decryptFieldValue(encryptedPhoneNumberId);
  const accessToken = decryptFieldValue(encryptedAccessToken);

  if (!phoneNumberId || !accessToken) {
    throw new Error("Invalid WhatsApp sender configuration after decryption.");
  }

  return {
    apiBaseUrl: env.whatsappGraphApiBaseUrl,
    phoneNumberId,
    accessToken,
  };
};

const resolveTemplateBodyParameters = (
  templateName: string,
  variables: Record<string, unknown>,
  templateVariables?: unknown[],
): string[] => {
  if (Array.isArray(templateVariables) && templateVariables.length > 0) {
    return templateVariables.map(value => String(value ?? ""));
  }

  const templateConfig = getTemplateConfig(templateName);
  const templateVariableKeys = templateConfig?.variableKeys;
  if (Array.isArray(templateVariableKeys) && templateVariableKeys.length > 0) {
    return templateVariableKeys.map((key: string) => String(variables[key] ?? ""));
  }

  return Object.values(variables).map(value => String(value ?? ""));
};

const resolveTextMessage = (jobData: OutboundJobData): string => {
  const explicitMessage = String(jobData.message || "").trim();
  if (explicitMessage) {
    return explicitMessage;
  }

  const variables = (jobData.variables || {}) as Record<string, unknown>;
  const templateName = String(jobData.templateName || "").trim();
  const templateConfig = templateName ? getTemplateConfig(templateName) : null;
  if (typeof templateConfig?.text === "string" && templateConfig.text.trim().length > 0) {
    return replaceTokens(templateConfig.text, variables).trim();
  }

  if (typeof variables.summary === "string" && variables.summary.trim().length > 0) {
    return variables.summary.trim();
  }

  if (Object.keys(variables).length > 0) {
    return JSON.stringify(variables);
  }

  throw new Error("No text message content available for outbound job.");
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

export const startOutboundWorker = (): Worker => {
  return new Worker(
    "wa.outbound",
    async job => {
      const jobData = (job.data || {}) as OutboundJobData;
      const messageLogId = jobData.messageLogId;
      const recipientPhone = normalizePhone(String(jobData.to || ""));

      if (!recipientPhone) {
        throw new Error("Recipient phone number is required for outbound job.");
      }

      try {
        const graphConfig = resolveGraphConfig(jobData);
        const messageType = String(jobData.messageType || "").toLowerCase();
        const templateName = String(jobData.templateName || "").trim();
        const variables = (jobData.variables || {}) as Record<string, unknown>;
        const templateConfig = templateName ? getTemplateConfig(templateName) : null;
        const shouldSendTemplate =
          messageType === "template" ||
          messageType === "receipt" ||
          templateConfig?.messageType === "template";
        if (shouldSendTemplate && !templateName) {
          throw new Error("Template name is required for template outbound messages.");
        }

        const providerResponse =
          shouldSendTemplate
            ? await sendWhatsAppTemplateMessage(graphConfig, {
                to: recipientPhone,
                templateName,
                languageCode:
                  String(jobData.language || templateConfig?.language || "en_US"),
                bodyParameters: resolveTemplateBodyParameters(
                  templateName,
                  variables,
                  jobData.templateVariables,
                ),
              })
            : await sendWhatsAppTextMessage(graphConfig, recipientPhone, resolveTextMessage(jobData));
        const templateProviderMessageId = readProviderMessageId(providerResponse);
        logger.info("RES FROM WHATSAPP", {
          jobId: String(job.id || ""),
          to: recipientPhone,
          messageType: shouldSendTemplate ? "template" : "text",
          templateName: templateName || undefined,
          response: providerResponse,
        });

        const followUpMessage = String(jobData.followUp?.message || "").trim();
        if (shouldSendTemplate && followUpMessage) {
          if (!templateProviderMessageId) {
            throw new Error("Template accepted without provider message id; skipping follow-up.");
          }
          // Give WhatsApp a short window to open conversation before text follow-up.
          await sleep(3000);
          const followUpResponse = await sendWhatsAppTextMessage(
            graphConfig,
            recipientPhone,
            followUpMessage,
          );
          logger.info("RES FROM WHATSAPP", {
            jobId: String(job.id || ""),
            to: recipientPhone,
            messageType: "text",
            templateName: undefined,
            response: followUpResponse,
            stage: "followUp",
          });
        }

        if (messageLogId) {
          await WhatsAppMessageLogModel.findByIdAndUpdate(messageLogId, {
            $set: {
              status: "sent",
              sentAt: new Date(),
              providerMessageId: templateProviderMessageId || undefined,
            },
          });
        }

        return { processed: true, providerMessageId: templateProviderMessageId };
      } catch (error) {
        if (messageLogId) {
          await WhatsAppMessageLogModel.findByIdAndUpdate(messageLogId, {
            $set: {
              status: "failed",
              error: (error as Error).message,
            },
          });
        }
        logger.error("RES FROM WHATSAPP ERROR", {
          jobId: String(job.id || ""),
          to: recipientPhone,
          messageType: String(jobData.messageType || ""),
          templateName: String(jobData.templateName || ""),
          error: (error as Error).message,
        });
        throw error;
      }
    },
    { connection: queueConnection, prefix: "gymflow" },
  );
};
