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
import { fail, ok } from "./common/utils/http";

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
  ok(res, { status: "healthy" }, "Platform API is healthy");
});

app.get("/ready", async (_req, res) => {
  try {
    const redisReady = await checkRedisReady();
    const mongoReady = isMongoReady();
    const ready = redisReady && mongoReady;
    if (ready) {
      ok(res, { checks: { mongo: mongoReady, redis: redisReady } }, "Platform API is ready");
      return;
    }

    fail(res, 503, "Platform API is not ready", [
      { field: "mongo", message: mongoReady ? "ok" : "not ready" },
      { field: "redis", message: redisReady ? "ok" : "not ready" }
    ]);
  } catch (error) {
    logger.error("Readiness check failed", { error: (error as Error).message });
    fail(res, 503, "Platform API is not ready", [{ field: "dependency", message: (error as Error).message }]);
  }
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(env.apiPrefix, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
