import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";

const toSha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const hashPassword = (plainPassword: string): string => {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(plainPassword, salt, 64).toString("hex");
    return `s2$${salt}$${derivedKey}`;
};

export const hashPasswordBcrypt = async (plainPassword: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
};

export const verifyPassword = (plainPassword: string, storedHash: string): boolean => {
    if (storedHash.startsWith("$2b$") || storedHash.startsWith("$2a$")) {
        return bcrypt.compareSync(plainPassword, storedHash);
    }

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
