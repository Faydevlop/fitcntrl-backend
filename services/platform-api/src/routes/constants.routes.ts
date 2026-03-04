import { Router } from "express";
import { constantsController } from "../modules/constants/controller/constants.controller";
import { asyncHandler } from "../middlewares/async-handler.middleware";

export const constantsRoutes = Router();

/**
 * @swagger
 * tags:
 *   - name: Constants
 *     description: Static and platform option constants for frontend forms.
 *
 * /api/constants:
 *   get:
 *     tags: [Constants]
 *     summary: Get platform constants and option sets
 *     description: Returns owner platform types and option sets sourced from constants.ts.
 *     responses:
 *       200:
 *         description: Constants fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                 data:
 *                   type: object
 *                   properties:
 *                     platformTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [gym, yoga, fitness, dance, personal_training, other]
 *                     gym_options:
 *                       type: object
 *                     yoga_options:
 *                       type: object
 *                     fitness_options:
 *                       type: object
 *                     dance_options:
 *                       type: object
 *                     personal_training_options:
 *                       type: object
 *                     other_options:
 *                       type: object
 */
constantsRoutes.get("/", asyncHandler(constantsController.getAll));

