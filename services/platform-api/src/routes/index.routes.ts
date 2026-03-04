import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { adminRoutes } from "./admin.routes";
import { gymRoutes } from "./gym.routes";
import { constantsRoutes } from "./constants.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/gym", gymRoutes);
apiRouter.use("/constants", constantsRoutes);
