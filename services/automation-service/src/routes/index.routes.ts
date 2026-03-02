import { Router } from "express";
import { whatsappRoutes } from "./whatsapp.routes";
import { authRoutes } from "./auth.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/whatsapp", whatsappRoutes);
