import { createCipheriv, createDecipheriv, createHash, createHmac } from "crypto";
import { env } from "../../config/env";

const ENCRYPTION_VERSION = "encv1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = createHash("sha256")
  .update(process.env.DATA_ENCRYPTION_KEY || env.jwtSecret)
  .digest();

const normalizeValue = (value: string): string => value.trim();

const deriveDeterministicIv = (value: string): Buffer => {
  return createHmac("sha256", ENCRYPTION_KEY)
    .update(`iv:${value}`)
    .digest()
    .subarray(0, 12);
};

export const isEncryptedFieldValue = (value: string): boolean => {
  return normalizeValue(value).startsWith(`${ENCRYPTION_VERSION}.`);
};

export const encryptFieldValue = (rawValue: string): string => {
  const value = normalizeValue(rawValue);
  if (!value) {
    return "";
  }
  if (isEncryptedFieldValue(value)) {
    return value;
  }

  // Deterministic IV keeps encrypted values stable for unique indexed fields.
  const iv = deriveDeterministicIv(value);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_VERSION}.${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

export const decryptFieldValue = (rawValue: string): string => {
  const value = normalizeValue(rawValue);
  if (!value) {
    return "";
  }
  if (!isEncryptedFieldValue(value)) {
    return value;
  }

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Invalid encrypted field format");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const authTag = Buffer.from(parts[2], "base64url");
  const encrypted = Buffer.from(parts[3], "base64url");

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
};
