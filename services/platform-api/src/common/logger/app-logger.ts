import { env } from "../../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const currentLevel = env.logLevel;

const shouldLog = (level: LogLevel): boolean => {
  return levelWeight[level] >= levelWeight[currentLevel];
};

const emit = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    service: env.serviceName,
    ts: new Date().toISOString(),
    message,
    ...(meta ? { meta } : {})
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta)
};
