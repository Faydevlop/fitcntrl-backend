import { Router } from "express";
import { gymController } from "../modules/gym/controller/gym.controller";
import { allowRoles, requireAuthenticated } from "../middlewares/auth.middleware";
import { requireBodyKeys, requireObjectIdParam } from "../middlewares/validate.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";

export const gymRoutes = Router();
gymRoutes.use(requireAuthenticated, allowRoles("gym_owner"));

/**
 * @swagger
 * tags:
 *   - name: Gym
 *     description: Gym owner APIs
 *
 * /api/gym/members/getAll:
 *   post:
 *     tags: [Gym]
 *     summary: List members with table query payload
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Members fetched
 *
 * /api/gym/payments/getAll:
 *   post:
 *     tags: [Gym]
 *     summary: List payments with table query payload
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Payments fetched
 *
 * /api/gym/payments/pending/getAll:
 *   post:
 *     tags: [Gym]
 *     summary: List pending payments with table query payload
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Pending payments fetched
 *
 * /api/gym/dashboard/stats:
 *   get:
 *     tags: [Gym]
 *     summary: Get dashboard summary
 *     responses:
 *       200:
 *         description: Dashboard stats fetched
 *
 * /api/gym/dashboard/growth:
 *   get:
 *     tags: [Gym]
 *     summary: Get member growth data
 *     responses:
 *       200:
 *         description: Dashboard growth fetched
 *
 * /api/gym/members:
 *   get:
 *     tags: [Gym]
 *     summary: List gym members
 *     responses:
 *       200:
 *         description: Members fetched
 *   post:
 *     tags: [Gym]
 *     summary: Create member
 *     responses:
 *       201:
 *         description: Member created
 *
 * /api/gym/members/{id}:
 *   get:
 *     tags: [Gym]
 *     summary: Get member details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member fetched
 *   patch:
 *     tags: [Gym]
 *     summary: Update member
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member updated
 *   delete:
 *     tags: [Gym]
 *     summary: Remove or blacklist member
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed
 *
 * /api/gym/payments:
 *   get:
 *     tags: [Gym]
 *     summary: List member payments
 *     responses:
 *       200:
 *         description: Payments fetched
 *   post:
 *     tags: [Gym]
 *     summary: Record member payment
 *     responses:
 *       201:
 *         description: Payment recorded
 *
 * /api/gym/payments/pending:
 *   get:
 *     tags: [Gym]
 *     summary: List pending dues
 *     responses:
 *       200:
 *         description: Pending payments fetched
 *
 * /api/gym/billing:
 *   get:
 *     tags: [Gym]
 *     summary: Get subscription billing details
 *     responses:
 *       200:
 *         description: Billing fetched
 *   patch:
 *     tags: [Gym]
 *     summary: Update gym settings and billing preferences
 *     responses:
 *       200:
 *         description: Gym settings updated
 *
 * /api/gym/support:
 *   get:
 *     tags: [Gym]
 *     summary: List support tickets
 *     responses:
 *       200:
 *         description: Support tickets fetched
 *   post:
 *     tags: [Gym]
 *     summary: Create support ticket
 *     responses:
 *       201:
 *         description: Support ticket created
 *
 * /api/gym/support/getAll:
 *   post:
 *     tags: [Gym]
 *     summary: List support tickets with table query payload
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableQueryRequest'
 *     responses:
 *       200:
 *         description: Support tickets fetched
 */
gymRoutes.get("/dashboard/stats", asyncHandler(gymController.dashboardStats));
gymRoutes.get("/dashboard/growth", asyncHandler(gymController.dashboardGrowth));

gymRoutes.get("/members", asyncHandler(gymController.listMembers));
gymRoutes.post("/members/getAll", asyncHandler(gymController.listMembers));
gymRoutes.post(
  "/members",
  requireBodyKeys("name", "countryCode", "phone", "plan", "fee"),
  asyncHandler(gymController.createMember),
);
gymRoutes.get("/members/:id", requireObjectIdParam("id"), asyncHandler(gymController.getMemberById));
gymRoutes.patch("/members/:id", requireObjectIdParam("id"), asyncHandler(gymController.updateMember));
gymRoutes.delete("/members/:id", requireObjectIdParam("id"), asyncHandler(gymController.deleteMember));

gymRoutes.get("/payments", asyncHandler(gymController.listPayments));
gymRoutes.post("/payments/getAll", asyncHandler(gymController.listPayments));
gymRoutes.post(
  "/payments",
  requireBodyKeys("memberId", "amount", "paidDate", "monthLabel", "method"),
  asyncHandler(gymController.createPayment),
);
gymRoutes.get("/payments/pending", asyncHandler(gymController.pendingPayments));
gymRoutes.post("/payments/pending/getAll", asyncHandler(gymController.pendingPayments));

gymRoutes.get("/billing", asyncHandler(gymController.billingSummary));
gymRoutes.patch("/billing", asyncHandler(gymController.updateSettings));
gymRoutes.get("/support", asyncHandler(gymController.listSupportTickets));
gymRoutes.post("/support/getAll", asyncHandler(gymController.listSupportTickets));
gymRoutes.post(
  "/support",
  requireBodyKeys("subject", "message"),
  asyncHandler(gymController.createSupportTicket),
);
