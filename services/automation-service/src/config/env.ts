import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";
type LogLevel = "debug" | "info" | "warn" | "error";
type RedisConfig = {
  redisHost: string;
  redisPort: number;
  redisUsername: string;
  redisPassword: string;
  redisTls: boolean;
};

const readRequired = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${key}`);
  }
  return value;
};

const readOptional = (key: string, fallback: string): string => {
  return process.env[key] || fallback;
};

const readNumber = (key: string, fallback: number): number => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }
  const parsedValue = Number(rawValue);
  if (Number.isNaN(parsedValue)) {
    throw new Error(`[config] Environment variable ${key} must be a number`);
  }
  return parsedValue;
};

const readBoolean = (key: string, fallback: boolean): boolean => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }
  return rawValue.toLowerCase() === "true";
};

const parseCorsAllowlist = (): string[] => {
  const raw = process.env.CORS_ALLOWLIST || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const parseDnsServers = (): string[] => {
  const raw = process.env.MONGO_DNS_SERVERS || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const parseRedisConfig = (): RedisConfig => {
  const rawUrl = process.env.REDIS_URL?.trim();
  if (rawUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error("[config] REDIS_URL must be a valid redis:// or rediss:// URL");
    }

    const protocol = parsedUrl.protocol.toLowerCase();
    if (protocol !== "redis:" && protocol !== "rediss:") {
      throw new Error("[config] REDIS_URL must start with redis:// or rediss://");
    }

    return {
      redisHost: parsedUrl.hostname,
      redisPort: Number(parsedUrl.port || (protocol === "rediss:" ? 6380 : 6379)),
      redisUsername: decodeURIComponent(parsedUrl.username || "default"),
      redisPassword: decodeURIComponent(parsedUrl.password || ""),
      redisTls: protocol === "rediss:"
    };
  }

  return {
    redisHost: readRequired("REDIS_HOST"),
    redisPort: readNumber("REDIS_PORT", 6379),
    redisUsername: readOptional("REDIS_USERNAME", "default"),
    redisPassword: readRequired("REDIS_PASSWORD"),
    redisTls: readBoolean("REDIS_TLS", false)
  };
};

const redis = parseRedisConfig();

export const env = {
  nodeEnv: readOptional("NODE_ENV", "development") as NodeEnv,
  serviceName: readOptional("SERVICE_NAME", "fitcntrl-automation-service"),
  logLevel: readOptional("LOG_LEVEL", "info") as LogLevel,
  port: readNumber("PORT", 4001),
  apiPrefix: readOptional("API_PREFIX", "/api"),
  mongoUri: readRequired("MONGO_URI"),
  redisHost: redis.redisHost,
  redisPort: redis.redisPort,
  redisUsername: redis.redisUsername,
  redisPassword: redis.redisPassword,
  redisTls: redis.redisTls,
  webhookVerifyToken: readRequired("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
  internalApiToken: readRequired("INTERNAL_API_TOKEN"),
  mongoDnsServers: parseDnsServers(),
  corsAllowlist: parseCorsAllowlist(),
  rateLimitWindowMs: readNumber("RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000),
  rateLimitMax: readNumber("RATE_LIMIT_MAX", 1200)
};
