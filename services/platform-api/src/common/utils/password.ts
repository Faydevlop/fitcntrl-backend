import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const toSha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const hashPassword = (plainPassword: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(plainPassword, salt, 64).toString("hex");
  return `s2$${salt}$${derivedKey}`;
};

export const verifyPassword = (plainPassword: string, storedHash: string): boolean => {
  if (storedHash.startsWith("s2$")) {
    const [, salt, hash] = storedHash.split("$");
    if (!salt || !hash) {
      return false;
    }
    const derivedKey = scryptSync(plainPassword, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derivedKey, "hex"));
  }

  return toSha256(plainPassword) === storedHash;
};
