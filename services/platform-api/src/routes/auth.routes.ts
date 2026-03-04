import { Router } from "express";
import { authController } from "../modules/auth/controller/auth.controller";
import { allowRoles, requireAuthenticated } from "../middlewares/auth.middleware";
import { requireBodyKeys } from "../middlewares/validate.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";

export const authRoutes = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication APIs
 *
 * components:
 *   parameters:
 *     DemoDbHeader:
 *       in: header
 *       name: x-demodb
 *       schema:
 *         type: string
 *         enum: ["true", "false"]
 *         default: "false"
 *       description: Use demo database if true
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login for Admin and Gym Owners
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokenType: { type: string }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *                 expiresInSeconds: { type: integer }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     role: { type: string }
 *                     gymId: { type: string, nullable: true }
 *                     currentPlanId: { type: string, nullable: true }
 *                     platformType: { type: string, nullable: true, enum: [gym, yoga, fitness, dance, personal_training, other] }
 *
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new gym owner account
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, countryCode, phone, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               countryCode: { type: string, example: "91" }
 *               phone: { type: string }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Signup successful
 *
 * /api/auth/onboarding:
 *   post:
 *     tags: [Auth]
 *     summary: Complete owner onboarding and persist platform-specific setup
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platformType, businessName, ownerName, phone]
 *             properties:
 *               platformType:
 *                 type: string
 *                 enum: [gym, yoga, fitness, dance, personal_training, other]
 *               businessName: { type: string }
 *               ownerName: { type: string }
 *               phone: { type: string }
 *               city: { type: string }
 *               address: { type: string }
 *               upiId: { type: string }
 *               displayName: { type: string }
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset OTP
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: OTP sent to email (if user exists)
 *
 * /api/auth/verify-code:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and update password
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "123456" }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password updated successfully
 *
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password for authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Fetch current user profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DemoDbHeader'
 *     responses:
 *       200:
 *         description: Profile fetched
 * */
authRoutes.post(
  "/signup",
  requireBodyKeys("name", "email", "countryCode", "phone", "password"),
  asyncHandler(authController.signup),
);
authRoutes.post("/login", requireBodyKeys("email", "password"), asyncHandler(authController.login));
authRoutes.post(
  "/onboarding",
  requireAuthenticated,
  allowRoles("gym_owner"),
  requireBodyKeys("platformType", "businessName", "ownerName", "phone"),
  asyncHandler(authController.onboarding),
);
authRoutes.post("/forgot-password", requireBodyKeys("email"), asyncHandler(authController.forgotPassword));
authRoutes.post(
  "/verify-code",
  requireBodyKeys("email", "code", "newPassword"),
  asyncHandler(authController.verifyCode),
);
authRoutes.post(
  "/reset-password",
  requireAuthenticated,
  requireBodyKeys("oldPassword", "newPassword"),
  asyncHandler(authController.resetPassword),
);
authRoutes.get("/me", requireAuthenticated, asyncHandler(authController.me));
