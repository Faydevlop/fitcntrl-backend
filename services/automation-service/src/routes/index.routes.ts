import { Router } from "express";
import { whatsappRoutes } from "./whatsapp.routes";

export const apiRouter = Router();

apiRouter.use("/whatsapp", whatsappRoutes);
