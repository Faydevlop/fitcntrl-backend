import { UserModel } from "../modules/auth/model/user.model";
import { hashPasswordBcrypt } from "../common/utils/password";
import { adminConfig } from "../config/admin-config";
import { logger } from "../common/logger/app-logger";
import { connectMongo, disconnectMongo } from "../bootstrap/mongo";

export const seedAdmin = async () => {
  try {
    const adminEmail = adminConfig.adminEmail;
    const adminPassword = adminConfig.adminPassword;

    const existingAdmin = await UserModel.findOne({ email: adminEmail });
    if (existingAdmin) {
      logger.info("Admin user already exists, skipping seed.");
      return;
    }

    const passwordHash = await hashPasswordBcrypt(adminPassword);

    await UserModel.create({
      name: "Platform Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      onboardingComplete: true,
      isActive: true,
    });

    logger.info("Admin user seeded successfully", { email: adminEmail });
  } catch (error) {
    logger.error("Error seeding admin user", { error: (error as Error).message });
  }
};

if (require.main === module) {
  const runSeed = async () => {
    await connectMongo();
    await seedAdmin();
    await disconnectMongo();
    process.exit(0);
  };
  runSeed().catch(err => {
    logger.error("Seed script failed", { error: err.message });
    process.exit(1);
  });
}
