import { Router } from "express";
import { webhookController } from "../modules/webhook/controller/webhook.controller";
import { outboundController } from "../modules/outbound/controller/outbound.controller";
import { statusController } from "../modules/status/controller/status.controller";
import { requireAuthenticated } from "../middlewares/auth.middleware";
import { requireBodyKeys } from "../middlewares/validate.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";

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
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Reminder queued
 *
 * /api/whatsapp/send-report:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Queue owner report send
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Report queued
 *
 * /api/whatsapp/status:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Check WhatsApp service status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status fetched
 */
whatsappRoutes.get("/webhook", webhookController.verify);
whatsappRoutes.post("/webhook", asyncHandler(webhookController.receive));
whatsappRoutes.post(
  "/send-reminder",
  requireAuthenticated,
  requireBodyKeys("gymId", "memberId"),
  asyncHandler(outboundController.sendReminder),
);
whatsappRoutes.post(
  "/send-report",
  requireAuthenticated,
  requireBodyKeys("gymId", "reportType"),
  asyncHandler(outboundController.sendReport),
);
whatsappRoutes.get("/status", requireAuthenticated, asyncHandler(outboundController.status));
whatsappRoutes.get("/internal/health", requireAuthenticated, asyncHandler(statusController.health));
