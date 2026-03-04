import { Router } from "express";
import { adminController } from "../modules/admin/controller/admin.controller";
import { allowRoles, requireAuthenticated } from "../middlewares/auth.middleware";
import { requireBodyKeys, requireObjectIdParam } from "../middlewares/validate.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";

export const adminRoutes = Router();
adminRoutes.use(requireAuthenticated, allowRoles("admin"));

/**
 * @swagger
 * tags:
 *   - name: Admin Gyms
 *     description: Gym onboarding and lifecycle management.
 *   - name: Admin Plans
 *     description: Subscription plan management.
 *   - name: Admin Subscriptions
 *     description: Subscription and platform revenue views.
 *   - name: Admin WhatsApp
 *     description: WhatsApp infrastructure and line controls.
 *   - name: Admin Activity
 *     description: Audit activity logs.
 *   - name: Admin Announcements
 *     description: Platform broadcast announcements.
 *   - name: Admin Enquiries
 *     description: Sales and contact enquiry management.
 *   - name: Admin Support
 *     description: Gym owner support ticket management.
 *
 * /api/admin/gyms/getAll:
 *   post:
 *     tags: [Admin Gyms]
 *     summary: List gyms (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Gyms fetched
 *
 * /api/admin/plans/getAll:
 *   post:
 *     tags: [Admin Plans]
 *     summary: List plans (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Plans fetched
 *
 * /api/admin/subscriptions/getAll:
 *   post:
 *     tags: [Admin Subscriptions]
 *     summary: List subscriptions (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Subscriptions fetched
 *
 * /api/admin/subscription-payments/getAll:
 *   post:
 *     tags: [Admin Subscriptions]
 *     summary: List subscription payments (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Subscription payments fetched
 *
 * /api/admin/whatsapp-phones/getAll:
 *   post:
 *     tags: [Admin WhatsApp]
 *     summary: List WhatsApp lines (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: WhatsApp lines fetched
 *
 * /api/admin/activity-logs/getAll:
 *   post:
 *     tags: [Admin Activity]
 *     summary: List activity logs (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Activity logs fetched
 *
 * /api/admin/announcements/getAll:
 *   post:
 *     tags: [Admin Announcements]
 *     summary: List announcements (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Announcements fetched
 *
 * /api/admin/enquiries/getAll:
 *   post:
 *     tags: [Admin Enquiries]
 *     summary: List enquiries (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Enquiries fetched
 *
 * /api/admin/owner-support/getAll:
 *   post:
 *     tags: [Admin Support]
 *     summary: List owner support tickets (table query filters/search/sort/pagination)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Owner support tickets fetched
 *
 * /api/admin/gyms:
 *   get:
 *     tags: [Admin Gyms]
 *     summary: List all gyms
 *     responses:
 *       200:
 *         description: Gyms fetched
 *   post:
 *     tags: [Admin Gyms]
 *     summary: Onboard a new gym
 *     responses:
 *       201:
 *         description: Gym created
 *
 * /api/admin/gyms/{id}:
 *   get:
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Gyms]
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
 *     tags: [Admin Plans]
 *     summary: List plans
 *     responses:
 *       200:
 *         description: Plans fetched
 *   post:
 *     tags: [Admin Plans]
 *     summary: Create plan
 *     responses:
 *       201:
 *         description: Plan created
 *
 * /api/admin/plans/{id}:
 *   patch:
 *     tags: [Admin Plans]
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
 *     tags: [Admin Subscriptions]
 *     summary: List gym subscriptions
 *     responses:
 *       200:
 *         description: Subscriptions fetched
 *
 * /api/admin/revenue-stats:
 *   get:
 *     tags: [Admin Subscriptions]
 *     summary: Platform revenue stats
 *     responses:
 *       200:
 *         description: Revenue stats fetched
 *
 * /api/admin/whatsapp-phones:
 *   get:
 *     tags: [Admin WhatsApp]
 *     summary: List WhatsApp lines
 *     responses:
 *       200:
 *         description: WhatsApp phones fetched
 *   post:
 *     tags: [Admin WhatsApp]
 *     summary: Add WhatsApp line
 *     responses:
 *       201:
 *         description: WhatsApp phone added
 *
 * /api/admin/whatsapp-phones/{id}:
 *   get:
 *     tags: [Admin WhatsApp]
 *     summary: Get WhatsApp line details (token visible only here)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: WhatsApp phone fetched
 *   patch:
 *     tags: [Admin WhatsApp]
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
 *     tags: [Admin Activity]
 *     summary: Fetch activity logs
 *     responses:
 *       200:
 *         description: Activity logs fetched
 *
 * /api/admin/announcements:
 *   get:
 *     tags: [Admin Announcements]
 *     summary: List announcements
 *     responses:
 *       200:
 *         description: Announcements fetched
 *   post:
 *     tags: [Admin Announcements]
 *     summary: Create announcement
 *     responses:
 *       201:
 *         description: Announcement created
 *
 * /api/admin/enquiries:
 *   get:
 *     tags: [Admin Enquiries]
 *     summary: List sales enquiries
 *     responses:
 *       200:
 *         description: Enquiries fetched
 *
 * /api/admin/owner-support:
 *   get:
 *     tags: [Admin Support]
 *     summary: List owner support tickets
 *     responses:
 *       200:
 *         description: Owner support tickets fetched
 */
adminRoutes.get("/gyms", asyncHandler(adminController.listGyms));
adminRoutes.post("/gyms/getAll", asyncHandler(adminController.listGyms));
adminRoutes.post(
  "/gyms",
  requireBodyKeys("name", "ownerName", "phone", "planId"),
  asyncHandler(adminController.createGym),
);
adminRoutes.get("/gyms/:id", requireObjectIdParam("id"), asyncHandler(adminController.getGymById));
adminRoutes.patch("/gyms/:id", requireObjectIdParam("id"), asyncHandler(adminController.updateGym));
adminRoutes.delete("/gyms/:id", requireObjectIdParam("id"), asyncHandler(adminController.deleteGym));
adminRoutes.post("/gyms/:id/freeze", requireObjectIdParam("id"), asyncHandler(adminController.freezeGym));
adminRoutes.post("/gyms/:id/unfreeze", requireObjectIdParam("id"), asyncHandler(adminController.unfreezeGym));
adminRoutes.post("/gyms/:id/reset-wa", requireObjectIdParam("id"), asyncHandler(adminController.resetGymWa));

adminRoutes.get("/plans", asyncHandler(adminController.listPlans));
adminRoutes.post("/plans/getAll", asyncHandler(adminController.listPlans));
adminRoutes.post(
  "/plans",
  requireBodyKeys("name", "billing", "price"),
  asyncHandler(adminController.createPlan),
);
adminRoutes.patch("/plans/:id", requireObjectIdParam("id"), asyncHandler(adminController.updatePlan));

adminRoutes.get("/subscriptions", asyncHandler(adminController.listSubscriptions));
adminRoutes.post("/subscriptions/getAll", asyncHandler(adminController.listSubscriptions));
adminRoutes.get("/subscription-payments", asyncHandler(adminController.listSubscriptionPayments));
adminRoutes.post("/subscription-payments/getAll", asyncHandler(adminController.listSubscriptionPayments));
adminRoutes.get("/revenue-stats", asyncHandler(adminController.revenueStats));

adminRoutes.get("/whatsapp-phones", asyncHandler(adminController.listWhatsAppPhones));
adminRoutes.post("/whatsapp-phones/getAll", asyncHandler(adminController.listWhatsAppPhones));
adminRoutes.post(
  "/whatsapp-phones",
  requireBodyKeys("phone", "phoneNumberId", "wabaId", "tokenEncrypted"),
  asyncHandler(adminController.createWhatsAppPhone),
);
adminRoutes.get(
  "/whatsapp-phones/:id",
  requireObjectIdParam("id"),
  asyncHandler(adminController.getWhatsAppPhoneById),
);
adminRoutes.patch(
  "/whatsapp-phones/:id",
  requireObjectIdParam("id"),
  asyncHandler(adminController.updateWhatsAppPhone),
);

adminRoutes.get("/activity-logs", asyncHandler(adminController.listActivityLogs));
adminRoutes.post("/activity-logs/getAll", asyncHandler(adminController.listActivityLogs));
adminRoutes.get("/announcements", asyncHandler(adminController.listAnnouncements));
adminRoutes.post("/announcements/getAll", asyncHandler(adminController.listAnnouncements));
adminRoutes.post(
  "/announcements",
  requireBodyKeys("message"),
  asyncHandler(adminController.createAnnouncement),
);
adminRoutes.get("/enquiries", asyncHandler(adminController.listEnquiries));
adminRoutes.post("/enquiries/getAll", asyncHandler(adminController.listEnquiries));
adminRoutes.patch("/enquiries/:id", requireObjectIdParam("id"), asyncHandler(adminController.updateEnquiry));
adminRoutes.get("/owner-support", asyncHandler(adminController.listOwnerSupport));
adminRoutes.post("/owner-support/getAll", asyncHandler(adminController.listOwnerSupport));
adminRoutes.patch(
  "/owner-support/:id",
  requireObjectIdParam("id"),
  asyncHandler(adminController.updateOwnerSupport),
);
