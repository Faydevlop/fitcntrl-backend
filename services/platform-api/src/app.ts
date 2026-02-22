import express from "express";
import swaggerUi from "swagger-ui-express";
import { apiRouter } from "./routes/index.routes";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { attachRequestContext } from "./middlewares/request-context.middleware";
import { applySecurityHeaders, corsGate } from "./middlewares/security.middleware";
import { createIpThrottle } from "./middlewares/ip-throttle.middleware";
import { isMongoReady } from "./bootstrap/mongo";
import { checkRedisReady } from "./bootstrap/redis";
import { logger } from "./common/logger/app-logger";
import { requestLog } from "./middlewares/request-log.middleware";

export const app = express();

app.disable("x-powered-by");
app.use(attachRequestContext);
app.use(requestLog);
app.use(createIpThrottle(env.rateLimitWindowMs, env.rateLimitMax));
app.use(corsGate);
app.use(applySecurityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Platform API is healthy"
  });
});

app.get("/ready", async (_req, res) => {
  try {
    const redisReady = await checkRedisReady();
    const mongoReady = isMongoReady();
    const ready = redisReady && mongoReady;
    res.status(ready ? 200 : 503).json({
      success: ready,
      message: ready ? "Platform API is ready" : "Platform API is not ready",
      checks: {
        mongo: mongoReady,
        redis: redisReady
      }
    });
  } catch (error) {
    logger.error("Readiness check failed", { error: (error as Error).message });
    res.status(503).json({
      success: false,
      message: "Platform API is not ready"
    });
  }
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(env.apiPrefix, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
