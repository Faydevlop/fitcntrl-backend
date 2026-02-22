import { Router } from "express";
import { webhookController } from "../modules/webhook/controller/webhook.controller";
import { outboundController } from "../modules/outbound/controller/outbound.controller";
import { statusController } from "../modules/status/controller/status.controller";
import { requireInternalAuth } from "../middlewares/internal-auth.middleware";
import { requireBodyKeys } from "../middlewares/validate.middleware";

export const whatsappRoutes = Router();

/**
 * @swagger
 * tags:
 *   - name: WhatsApp
 *     description: WhatsApp webhook and automation APIs
 *
 * /api/whatsapp/webhook:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Meta webhook verification
 *     responses:
 *       200:
 *         description: Verification challenge response
 *   post:
 *     tags: [WhatsApp]
 *     summary: Receive WhatsApp webhook events
 *     responses:
 *       200:
 *         description: Webhook received
 *
 * /api/whatsapp/send-reminder:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Queue payment reminder send
 *     security:
 *       - internalTokenAuth: []
 *     responses:
 *       201:
 *         description: Reminder queued
 *
 * /api/whatsapp/send-report:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Queue owner report send
 *     security:
 *       - internalTokenAuth: []
 *     responses:
 *       201:
 *         description: Report queued
 *
 * /api/whatsapp/status:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Check WhatsApp service status
 *     security:
 *       - internalTokenAuth: []
 *     responses:
 *       200:
 *         description: Status fetched
 */
whatsappRoutes.get("/webhook", webhookController.verify);
whatsappRoutes.post("/webhook", webhookController.receive);
whatsappRoutes.post(
  "/send-reminder",
  requireInternalAuth,
  requireBodyKeys("gymId", "memberId"),
  outboundController.sendReminder
);
whatsappRoutes.post(
  "/send-report",
  requireInternalAuth,
  requireBodyKeys("gymId", "reportType"),
  outboundController.sendReport
);
whatsappRoutes.get("/status", requireInternalAuth, outboundController.status);
whatsappRoutes.get("/internal/health", requireInternalAuth, statusController.health);
