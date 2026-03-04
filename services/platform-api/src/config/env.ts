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
    .map(value => value.trim())
    .filter(Boolean);
};

const parseDnsServers = (): string[] => {
  const raw = process.env.MONGO_DNS_SERVERS || "";
  return raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
};

const parseBackupTimes = (): number[] => {
  const raw = readOptional("BACKUP_TIMES", "0,1,2");
  const tokens = raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("[config] BACKUP_TIMES must contain at least one hour");
  }

  const hours = tokens.map(token => {
    const parsed = Number(token);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
      throw new Error(`[config] BACKUP_TIMES contains invalid hour: ${token}`);
    }
    return parsed;
  });

  return [...new Set(hours)].sort((a, b) => a - b);
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
      redisTls: protocol === "rediss:",
    };
  }

  return {
    redisHost: readRequired("REDIS_HOST"),
    redisPort: readNumber("REDIS_PORT", 6379),
    redisUsername: readOptional("REDIS_USERNAME", "default"),
    redisPassword: readRequired("REDIS_PASSWORD"),
    redisTls: readBoolean("REDIS_TLS", false),
  };
};

const redis = parseRedisConfig();

export const env = {
  nodeEnv: readOptional("NODE_ENV", "development") as NodeEnv,
  serviceName: readOptional("SERVICE_NAME", "fitcntrl-platform-api"),
  logLevel: readOptional("LOG_LEVEL", "info") as LogLevel,
  port: readNumber("PORT", 4000),
  apiPrefix: readOptional("API_PREFIX", "/api"),
  mongoUri: readRequired("MONGO_URI"),
  mongoDemoUri: readRequired("MONGO_DEMO_URI"),
  redisHost: redis.redisHost,
  redisPort: redis.redisPort,
  redisUsername: redis.redisUsername,
  redisPassword: redis.redisPassword,
  redisTls: redis.redisTls,
  jwtSecret: readRequired("JWT_SECRET"),
  jwtExpiresIn: readOptional("JWT_EXPIRES_IN", "1d"),
  mongoDnsServers: parseDnsServers(),
  corsAllowlist: parseCorsAllowlist(),
  rateLimitWindowMs: readNumber("RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000),
  rateLimitMax: readNumber("RATE_LIMIT_MAX", 1500),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: readNumber("SMTP_PORT", 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpSecure: readBoolean("SMTP_SECURE", false),
  mailFrom: readOptional("MAIL_FROM", "no-reply@fitcntrl.com"),
  appName: readOptional("APP_NAME", "FitCntrl"),
  whatsappGraphApiBaseUrl: readOptional("WHATSAPP_GRAPH_API_BASE_URL", "https://graph.facebook.com/v24.0"),
  backupTimeZone: readOptional("BACKUP_TIMEZONE", "Asia/Kolkata"),
  backupRootDir: readOptional("BACKUP_ROOT_DIR", "backups"),
  backupTimes: parseBackupTimes(),
};
