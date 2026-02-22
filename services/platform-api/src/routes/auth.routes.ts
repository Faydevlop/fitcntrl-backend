import { Router } from "express";
import { authController } from "../modules/auth/controller/auth.controller";

export const authRoutes = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication APIs
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login for Admin and Gym Owners
 *     responses:
 *       200:
 *         description: Login handled
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset code
 *     responses:
 *       200:
 *         description: Reset code request handled
 *
 * /api/auth/verify-code:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password reset code
 *     responses:
 *       200:
 *         description: Code verification handled
 *
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset account password
 *     responses:
 *       200:
 *         description: Password reset handled
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Fetch current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched
 */
authRoutes.post("/login", authController.login);
authRoutes.post("/forgot-password", authController.forgotPassword);
authRoutes.post("/verify-code", authController.verifyCode);
authRoutes.post("/reset-password", authController.resetPassword);
authRoutes.get("/me", authController.me);
