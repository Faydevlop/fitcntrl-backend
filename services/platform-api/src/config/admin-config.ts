import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const configPath = resolve(process.cwd(), "src/config/admin-credentials.json");

if (!existsSync(configPath)) {
    throw new Error(`[config] admin-credentials.json not found at ${configPath}`);
}

const configData = JSON.parse(readFileSync(configPath, "utf-8"));

export const adminConfig = {
    adminEmail: configData.adminEmail,
    adminPassword: configData.adminPassword
};
