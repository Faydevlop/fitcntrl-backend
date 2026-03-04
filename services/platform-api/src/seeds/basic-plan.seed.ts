import { connectMongo, disconnectMongo } from "../bootstrap/mongo";
import { logger } from "../common/logger/app-logger";
import { PlanModel } from "../modules/admin/model/plan.model";

const DEFAULT_BASIC_PLAN = {
  name: "Basic",
  billing: "monthly" as const,
  price: 0,
  isBasic: true,
  maxMembers: 100,
  whatsappLimit: 500,
  features: ["Member Management", "Dashboard Analytics", "WhatsApp Reminders", "Payment History"],
  active: true,
  trialDays: 0,
  gracePeriodDays: 7,
};

export const seedBasicPlan = async () => {
  try {
    let basicPlan =
      (await PlanModel.findOne({ isBasic: true })) ||
      (await PlanModel.findOne({ name: DEFAULT_BASIC_PLAN.name, billing: DEFAULT_BASIC_PLAN.billing }));

    if (!basicPlan) {
      basicPlan = await PlanModel.create(DEFAULT_BASIC_PLAN);
      logger.info("Basic plan seeded successfully", { planId: basicPlan._id.toString() });
    } else {
      const updates: Record<string, unknown> = {};
      if (basicPlan.price !== 0) updates.price = 0;
      if (!basicPlan.active) updates.active = true;
      if (!basicPlan.isBasic) updates.isBasic = true;

      if (Object.keys(updates).length > 0) {
        await PlanModel.updateOne({ _id: basicPlan._id }, { $set: updates });
        logger.info("Basic plan normalized successfully", { planId: basicPlan._id.toString() });
      } else {
        logger.info("Basic plan already exists, skipping seed.", { planId: basicPlan._id.toString() });
      }
    }

    await PlanModel.updateMany(
      { _id: { $ne: basicPlan._id }, isBasic: true },
      { $set: { isBasic: false } },
    );
  } catch (error) {
    logger.error("Error seeding basic plan", { error: (error as Error).message });
  }
};

if (require.main === module) {
  const runSeed = async () => {
    await connectMongo();
    await seedBasicPlan();
    await disconnectMongo();
    process.exit(0);
  };

  runSeed().catch(err => {
    logger.error("Basic plan seed script failed", { error: err.message });
    process.exit(1);
  });
}
