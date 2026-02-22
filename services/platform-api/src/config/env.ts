import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";
type LogLevel = "debug" | "info" | "warn" | "error";

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

export const env = {
  nodeEnv: readOptional("NODE_ENV", "development") as NodeEnv,
  serviceName: readOptional("SERVICE_NAME", "fitcntrl-platform-api"),
  logLevel: readOptional("LOG_LEVEL", "info") as LogLevel,
  port: readNumber("PORT", 4000),
  apiPrefix: readOptional("API_PREFIX", "/api"),
  mongoUri: readRequired("MONGO_URI"),
  redisUrl: readRequired("REDIS_URL"),
  jwtSecret: readRequired("JWT_SECRET"),
  jwtExpiresIn: readOptional("JWT_EXPIRES_IN", "1d"),
  corsAllowlist: parseCorsAllowlist(),
  rateLimitWindowMs: readNumber("RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000),
  rateLimitMax: readNumber("RATE_LIMIT_MAX", 1500),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: readNumber("SMTP_PORT", 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpSecure: readBoolean("SMTP_SECURE", false),
  mailFrom: readOptional("MAIL_FROM", "no-reply@fitcntrl.com"),
  appName: readOptional("APP_NAME", "FitCntrl")
};
