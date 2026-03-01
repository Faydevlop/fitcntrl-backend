import { env } from "../../config/env";

export const queueConnection = {
  host: env.redisHost,
  port: env.redisPort,
  ...(env.redisUsername ? { username: env.redisUsername } : {}),
  ...(env.redisPassword ? { password: env.redisPassword } : {}),
  ...(env.redisTls ? { tls: {} } : {}),
};
