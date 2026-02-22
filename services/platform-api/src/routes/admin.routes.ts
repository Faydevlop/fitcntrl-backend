import { Router } from "express";
import { adminController } from "../modules/admin/controller/admin.controller";
import { allowRoles, requireAuthenticated } from "../middlewares/auth.middleware";
import { requireBodyKeys, requireObjectIdParam } from "../middlewares/validate.middleware";

export const adminRoutes = Router();
adminRoutes.use(requireAuthenticated, allowRoles("admin"));

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Super admin APIs
 *
 * /api/admin/gyms:
 *   get:
 *     tags: [Admin]
 *     summary: List all gyms
 *     responses:
 *       200:
 *         description: Gyms fetched
 *   post:
 *     tags: [Admin]
 *     summary: Onboard a new gym
 *     responses:
 *       201:
 *         description: Gym created
 *
 * /api/admin/gyms/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get gym details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym fetched
 *   patch:
 *     tags: [Admin]
 *     summary: Update gym details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym updated
 *   delete:
 *     tags: [Admin]
 *     summary: Suspend or remove gym
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym removed
 *
 * /api/admin/gyms/{id}/freeze:
 *   post:
 *     tags: [Admin]
 *     summary: Freeze gym account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym frozen
 *
 * /api/admin/gyms/{id}/unfreeze:
 *   post:
 *     tags: [Admin]
 *     summary: Unfreeze gym account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym unfrozen
 *
 * /api/admin/gyms/{id}/reset-wa:
 *   post:
 *     tags: [Admin]
 *     summary: Reset monthly WhatsApp usage
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: WhatsApp usage reset
 *
 * /api/admin/plans:
 *   get:
 *     tags: [Admin]
 *     summary: List plans
 *     responses:
 *       200:
 *         description: Plans fetched
 *   post:
 *     tags: [Admin]
 *     summary: Create plan
 *     responses:
 *       201:
 *         description: Plan created
 *
 * /api/admin/plans/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update plan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan updated
 *
 * /api/admin/subscriptions:
 *   get:
 *     tags: [Admin]
 *     summary: List gym subscriptions
 *     responses:
 *       200:
 *         description: Subscriptions fetched
 *
 * /api/admin/revenue-stats:
 *   get:
 *     tags: [Admin]
 *     summary: Platform revenue stats
 *     responses:
 *       200:
 *         description: Revenue stats fetched
 *
 * /api/admin/whatsapp-phones:
 *   get:
 *     tags: [Admin]
 *     summary: List WhatsApp lines
 *     responses:
 *       200:
 *         description: WhatsApp phones fetched
 *   post:
 *     tags: [Admin]
 *     summary: Add WhatsApp line
 *     responses:
 *       201:
 *         description: WhatsApp phone added
 *
 * /api/admin/whatsapp-phones/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update WhatsApp line credentials
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: WhatsApp phone updated
 *
 * /api/admin/activity-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Fetch activity logs
 *     responses:
 *       200:
 *         description: Activity logs fetched
 *
 * /api/admin/announcements:
 *   get:
 *     tags: [Admin]
 *     summary: List announcements
 *     responses:
 *       200:
 *         description: Announcements fetched
 *   post:
 *     tags: [Admin]
 *     summary: Create announcement
 *     responses:
 *       201:
 *         description: Announcement created
 *
 * /api/admin/enquiries:
 *   get:
 *     tags: [Admin]
 *     summary: List sales enquiries
 *     responses:
 *       200:
 *         description: Enquiries fetched
 *
 * /api/admin/owner-support:
 *   get:
 *     tags: [Admin]
 *     summary: List owner support tickets
 *     responses:
 *       200:
 *         description: Owner support tickets fetched
 */
adminRoutes.get("/gyms", adminController.listGyms);
adminRoutes.post("/gyms", requireBodyKeys("name", "ownerName", "phone", "planId"), adminController.createGym);
adminRoutes.get("/gyms/:id", requireObjectIdParam("id"), adminController.getGymById);
adminRoutes.patch("/gyms/:id", requireObjectIdParam("id"), adminController.updateGym);
adminRoutes.delete("/gyms/:id", requireObjectIdParam("id"), adminController.deleteGym);
adminRoutes.post("/gyms/:id/freeze", requireObjectIdParam("id"), adminController.freezeGym);
adminRoutes.post("/gyms/:id/unfreeze", requireObjectIdParam("id"), adminController.unfreezeGym);
adminRoutes.post("/gyms/:id/reset-wa", requireObjectIdParam("id"), adminController.resetGymWa);

adminRoutes.get("/plans", adminController.listPlans);
adminRoutes.post("/plans", requireBodyKeys("name", "billing", "price"), adminController.createPlan);
adminRoutes.patch("/plans/:id", requireObjectIdParam("id"), adminController.updatePlan);

adminRoutes.get("/subscriptions", adminController.listSubscriptions);
adminRoutes.get("/revenue-stats", adminController.revenueStats);

adminRoutes.get("/whatsapp-phones", adminController.listWhatsAppPhones);
adminRoutes.post(
  "/whatsapp-phones",
  requireBodyKeys("phone", "phoneNumberId", "wabaId", "tokenEncrypted"),
  adminController.createWhatsAppPhone
);
adminRoutes.patch("/whatsapp-phones/:id", requireObjectIdParam("id"), adminController.updateWhatsAppPhone);

adminRoutes.get("/activity-logs", adminController.listActivityLogs);
adminRoutes.get("/announcements", adminController.listAnnouncements);
adminRoutes.post("/announcements", requireBodyKeys("message"), adminController.createAnnouncement);
adminRoutes.get("/enquiries", adminController.listEnquiries);
adminRoutes.get("/owner-support", adminController.listOwnerSupport);
