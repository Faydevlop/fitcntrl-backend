import { Request } from "express";
import { Connection, PipelineStage, Types } from "mongoose";
import { monthKeyFromDate } from "../../../../common/utils/query";
import { hashPassword } from "../../../../common/utils/password";
import { decryptFieldValue, encryptFieldValue } from "../../../../common/utils/field-crypto";
import { fetchWhatsAppLineInsights } from "../../../../common/utils/whatsapp-insights";
import { DEFAULT_OWNER_PLATFORM_TYPE } from "../../../../common/constants/constants";
import { MESSAGE_CONSTANTS, TEMPLATE_NAMES } from "../../../../common/constants/templates";
import { normalizeTableQuery, buildTableSearchMatch } from "../../../../common/utils/table-query";
import { logger } from "../../../../common/logger/app-logger";
import { composePhoneWithCountryCode } from "../../../../common/utils/phone";
import { env } from "../../../../config/env";
import { waOutboundQueue } from "../../../../bootstrap/queues";
import { ActivityLogModel } from "../../model/activity-log.model";
import { AnnouncementModel } from "../../model/announcement.model";
import { EnquiryModel } from "../../model/enquiry.model";
import { GymModel } from "../../model/gym.model";
import { PlanModel } from "../../model/plan.model";
import { SubscriptionModel } from "../../model/subscription.model";
import { SubscriptionPaymentModel } from "../../model/subscription-payment.model";
import { SupportTicketModel } from "../../model/support-ticket.model";
import { WhatsAppLineModel } from "../../model/whatsapp-line.model";
import { WhatsAppUsageMonthlyModel } from "../../model/whatsapp-usage-monthly.model";
import { MessageModel } from "../../model/message.model";
import { UserModel } from "../../../auth/model/user.model";

type QueryInput = Record<string, unknown>;

const toObjectId = (value?: string): Types.ObjectId | null => {
  if (!value || !Types.ObjectId.isValid(value)) {
    return null;
  }
  return new Types.ObjectId(value);
};

const logAdminAction = async (
  req: Request | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> => {
  const actorUserId = req?.authContext?.userId;
  if (!actorUserId || !Types.ObjectId.isValid(actorUserId)) {
    return;
  }

  await ActivityLogModel.create({
    actorUserId: new Types.ObjectId(actorUserId),
    actorRole: "admin",
    action,
    entityType,
    entityId,
    ip: req?.ip,
    meta,
  });
};

const persistOutgoingMessages = async (req: Request | undefined, records: Record<string, unknown>[]) => {
  if (records.length === 0) {
    return;
  }
  const messageModel = (req?.db.models.Message as typeof MessageModel) || MessageModel;
  try {
    await messageModel.insertMany(records, { ordered: false });
  } catch (error) {
    logger.warn("Failed to write outgoing message logs", {
      count: records.length,
      error: (error as Error).message,
    });
  }
};

const toMonthStart = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
};

const addMonths = (date: Date, months: number): Date => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};

const getPlanSubscriptionMonths = (plan: { billing?: string; isBasic?: boolean }): number => {
  if (plan.isBasic) return 2;
  return plan.billing === "yearly" ? 12 : 1;
};

type WhatsAppLineShape = {
  _id?: Types.ObjectId;
  id?: string;
  phone?: string;
  phoneNumberId?: string;
  wabaId?: string;
  tokenEncrypted?: string;
  setForBasic?: boolean;
  assignedGymId?: Types.ObjectId | string | null;
  qualityRating?: string;
  isActive?: boolean;
};

const decryptWhatsAppLine = <T extends WhatsAppLineShape>(line: T): T => {
  return {
    ...line,
    phoneNumberId: decryptFieldValue(String(line.phoneNumberId || "")),
    wabaId: decryptFieldValue(String(line.wabaId || "")),
    tokenEncrypted: decryptFieldValue(String(line.tokenEncrypted || "")),
    setForBasic: Boolean(line.setForBasic),
  } as T;
};

const maskWhatsAppLineForList = <T extends WhatsAppLineShape>(line: T): T => {
  const decrypted = decryptWhatsAppLine(line);
  return {
    ...decrypted,
    tokenEncrypted: decrypted.tokenEncrypted ? "******" : "",
  } as T;
};

type GymWhatsAppUsageSnapshot = {
  messagesUsed: number;
  planLimit: number;
  messagesFailed: number;
  deliveryRate: number;
  conversationsCount: number;
  daily: unknown[];
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  qualityRating?: string;
  messagingLimitTier?: string;
  conversationAnalytics?: unknown;
};

const buildGymWhatsAppUsageMap = async (
  db: Connection,
  gymRows: Array<Record<string, unknown>>,
  includeLiveInsights = false,
): Promise<Map<string, GymWhatsAppUsageSnapshot>> => {
  const result = new Map<string, GymWhatsAppUsageSnapshot>();
  if (gymRows.length === 0) {
    return result;
  }

  const gymIds = gymRows
    .map(row => String(row?._id || ""))
    .filter(value => Types.ObjectId.isValid(value))
    .map(value => new Types.ObjectId(value));
  if (gymIds.length === 0) {
    return result;
  }

  const monthKey = monthKeyFromDate(new Date());
  const [usageRows, planRows, dedicatedLines, basicLineRaw] = await Promise.all([
    db.models.WhatsAppUsageMonthly.find({ gymId: { $in: gymIds }, monthKey }).lean(),
    db.models.Plan.find({
      _id: {
        $in: gymRows
          .map(row => String(row?.planId || ""))
          .filter(value => Types.ObjectId.isValid(value))
          .map(value => new Types.ObjectId(value)),
      },
    })
      .select("_id whatsappLimit")
      .lean(),
    db.models.WhatsAppLine.find({ assignedGymId: { $in: gymIds }, isActive: true }).lean(),
    db.models.WhatsAppLine.findOne({ setForBasic: true, isActive: true }).lean(),
  ]);

  const usageByGymId = new Map<string, Record<string, unknown>>();
  usageRows.forEach(row => usageByGymId.set(String(row.gymId), row as Record<string, unknown>));

  const planLimitByPlanId = new Map<string, number>();
  planRows.forEach(row => planLimitByPlanId.set(String(row._id), Number(row.whatsappLimit || 0)));

  const dedicatedByGymId = new Map<string, WhatsAppLineShape>();
  dedicatedLines.forEach(line => {
    const decrypted = decryptWhatsAppLine(line as WhatsAppLineShape);
    if (decrypted.assignedGymId) {
      dedicatedByGymId.set(String(decrypted.assignedGymId), decrypted);
    }
  });

  const basicLine = basicLineRaw ? decryptWhatsAppLine(basicLineRaw as WhatsAppLineShape) : null;

  const uniqueLineMap = new Map<string, WhatsAppLineShape>();
  dedicatedByGymId.forEach((line, gymId) => {
    uniqueLineMap.set(String(line._id || gymId), line);
  });
  if (basicLine) {
    uniqueLineMap.set(String(basicLine._id || "basic"), basicLine);
  }

  const lineInsightsById = new Map<string, Record<string, unknown>>();
  const startUnix = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
  const endUnix = Math.floor(Date.now() / 1000);

  if (includeLiveInsights) {
    await Promise.all(
      Array.from(uniqueLineMap.entries()).map(async ([lineId, line]) => {
        const phoneNumberId = String(line.phoneNumberId || "");
        const wabaId = String(line.wabaId || "");
        const accessToken = String(line.tokenEncrypted || "");
        if (!phoneNumberId || !wabaId || !accessToken) {
          return;
        }

        try {
          const insights = await fetchWhatsAppLineInsights({
            apiBaseUrl: env.whatsappGraphApiBaseUrl,
            phoneNumberId,
            wabaId,
            accessToken,
            startUnix,
            endUnix,
          });

          lineInsightsById.set(lineId, insights as unknown as Record<string, unknown>);

          if (
            insights.qualityRating &&
            insights.qualityRating.trim() &&
            insights.qualityRating !== String(line.qualityRating || "")
          ) {
            await db.models.WhatsAppLine.updateOne(
              { _id: line._id },
              { $set: { qualityRating: insights.qualityRating } },
            ).catch(() => undefined);
          }
        } catch (error) {
          logger.warn("Failed to fetch WhatsApp insights for line", {
            lineId,
            error: (error as Error).message,
          });
        }
      }),
    );
  }

  gymRows.forEach(row => {
    const gymId = String(row?._id || "");
    const gymMode = String(row?.waMode || "shared");
    const usageRow = usageByGymId.get(gymId);
    const planId = String(row?.planId || "");
    const attachedLine = gymMode === "dedicated" ? dedicatedByGymId.get(gymId) || null : basicLine;
    const lineIdKey = attachedLine ? String(attachedLine._id || "") : "";
    const insights = lineIdKey ? lineInsightsById.get(lineIdKey) : undefined;
    const conversationsFromInsights = Number(insights?.businessInitiatedConversations || 0);
    const conversationsFromUsage = Number(usageRow?.conversationsCount || 0);

    result.set(gymId, {
      messagesUsed: Number(usageRow?.messagesUsed || 0),
      planLimit: Number(usageRow?.planLimit || planLimitByPlanId.get(planId) || 0),
      messagesFailed: Number(usageRow?.messagesFailed || 0),
      deliveryRate: Number(usageRow?.deliveryRate || 0),
      conversationsCount: conversationsFromInsights > 0 ? conversationsFromInsights : conversationsFromUsage,
      daily: Array.isArray(usageRow?.daily) ? (usageRow?.daily as unknown[]) : [],
      phoneNumber: attachedLine?.phone ? String(attachedLine.phone) : undefined,
      phoneNumberId: attachedLine?.phoneNumberId ? String(attachedLine.phoneNumberId) : undefined,
      wabaId: attachedLine?.wabaId ? String(attachedLine.wabaId) : undefined,
      qualityRating:
        (typeof insights?.qualityRating === "string" && String(insights.qualityRating)) ||
        (attachedLine?.qualityRating ? String(attachedLine.qualityRating) : undefined),
      messagingLimitTier:
        typeof insights?.messagingLimitTier === "string"
          ? String(insights.messagingLimitTier)
          : undefined,
      conversationAnalytics: insights?.conversationAnalytics,
    });
  });

  return result;
};

export const adminCore = {
  async listGyms(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["name", "ownerName", "phone"],
    });

    const mongoFilters: Record<string, unknown> = {};
    const status = query.filters.status;
    const planId = query.filters.planId;
    const waMode = query.filters.waMode;
    const platformType = query.filters.platformType;
    const includeLiveWhatsAppInsights = String(query.filters.includeLiveWhatsAppInsights || "false") === "true";

    if (status) mongoFilters.status = String(status);
    if (waMode) mongoFilters.waMode = String(waMode);
    if (platformType) mongoFilters.platformType = String(platformType);
    if (planId && Types.ObjectId.isValid(String(planId))) {
      mongoFilters.planId = new Types.ObjectId(String(planId));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.Gym.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Gym.countDocuments(finalFilter),
    ]);
    const usageByGym = await buildGymWhatsAppUsageMap(
      db,
      tableData as Array<Record<string, unknown>>,
      includeLiveWhatsAppInsights,
    );
    const enrichedTableData = tableData.map(row => ({
      ...row,
      whatsappUsage: usageByGym.get(String(row._id)) || {
        messagesUsed: 0,
        planLimit: 0,
        messagesFailed: 0,
        deliveryRate: 0,
        conversationsCount: 0,
        daily: [],
      },
    }));

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData: enrichedTableData,
      items: enrichedTableData,
    };
  },

  async createGym(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const planId = String(payload.planId || "");
    const whatsappLineModel = (req?.db.models.WhatsAppLine as typeof WhatsAppLineModel) || WhatsAppLineModel;
    const assignedLineId = toObjectId(
      payload.assignedWhatsAppLineId ? String(payload.assignedWhatsAppLineId) : undefined,
    );
    const plan = await PlanModel.findById(planId);
    if (!plan) {
      throw new Error("Selected plan does not exist");
    }
    if (assignedLineId) {
      const line = await whatsappLineModel.findById(assignedLineId).lean();
      if (!line) {
        throw new Error("Selected WhatsApp line does not exist");
      }
      if (line.assignedGymId) {
        throw new Error("Selected WhatsApp line is already assigned");
      }
    }

    const now = new Date();
    const startDate = payload.startDate ? new Date(String(payload.startDate)) : now;
    const expiryDate =
      payload.expiryDate && !Number.isNaN(new Date(String(payload.expiryDate)).getTime())
        ? new Date(String(payload.expiryDate))
        : addMonths(startDate, getPlanSubscriptionMonths(plan));

    const ownerEmail =
      typeof payload.ownerEmail === "string" && payload.ownerEmail.trim().length > 0
        ? payload.ownerEmail.trim().toLowerCase()
        : `${String(payload.phone || "").replace(/\D/g, "") || Date.now()}@fitcntrl.local`;
    const existingOwner = await UserModel.findOne({ email: ownerEmail }).lean();
    if (existingOwner) {
      throw new Error("Owner email already exists");
    }

    const ownerPassword =
      typeof payload.ownerPassword === "string" && payload.ownerPassword.length >= 8
        ? payload.ownerPassword
        : "Owner@1234";
    const platformType =
      typeof payload.platformType === "string" && payload.platformType.trim().length > 0
        ? payload.platformType.trim()
        : DEFAULT_OWNER_PLATFORM_TYPE;

    const ownerUser = await UserModel.create({
      name: String(payload.ownerName || ""),
      email: ownerEmail,
      phone: String(payload.phone || ""),
      passwordHash: hashPassword(ownerPassword),
      role: "gym_owner",
      platformType,
      onboardingComplete: true,
      isActive: true,
    });

    const gym = await GymModel.create({
      name: String(payload.name || ""),
      ownerName: String(payload.ownerName || ""),
      ownerUserId: ownerUser._id,
      platformType,
      phone: String(payload.phone || ""),
      city: payload.city ? String(payload.city) : undefined,
      address: payload.address ? String(payload.address) : undefined,
      planId: plan._id,
      status: String(payload.status || "active"),
      waMode: String(payload.waMode || "shared"),
      upiId: payload.upiId ? String(payload.upiId) : undefined,
      gymDisplayName: payload.gymDisplayName ? String(payload.gymDisplayName) : undefined,
      subscription: {
        startDate,
        expiryDate,
        gracePeriodDays: plan.gracePeriodDays || 0,
        autoRenewal: true,
      },
    });

    ownerUser.gymId = gym._id;
    await ownerUser.save();

    if (assignedLineId) {
      await whatsappLineModel.updateOne(
        { _id: assignedLineId },
        { $set: { assignedGymId: gym._id, isActive: true } },
      );
    }

    await SubscriptionModel.create({
      gymId: gym._id,
      planId: plan._id,
      status: "active",
      paymentStatus: "pending",
      startDate,
      expiryDate,
      nextBillingDate: expiryDate,
    });

    await WhatsAppUsageMonthlyModel.findOneAndUpdate(
      { gymId: gym._id, monthKey: monthKeyFromDate(now) },
      {
        gymId: gym._id,
        monthKey: monthKeyFromDate(now),
        planLimit: plan.whatsappLimit,
        messagesUsed: 0,
        messagesFailed: 0,
        conversationsCount: 0,
        deliveryRate: 0,
        daily: [],
      },
      { upsert: true, new: true },
    );

    await logAdminAction(req, "Created Gym", "gym", gym._id.toString(), {
      planId: plan._id.toString(),
      assignedWhatsAppLineId: assignedLineId?.toString(),
    });

    return {
      id: gym._id.toString(),
      name: gym.name,
      ownerName: gym.ownerName,
      ownerEmail,
      ownerDefaultPassword: ownerPassword,
      planId: gym.planId.toString(),
      status: gym.status,
    };
  },

  async getGymById(id: string, db: Connection) {
    const gym = (await db.models.Gym.findById(id).lean()) as Record<string, unknown> | null;
    if (!gym) {
      throw new Error("Gym not found");
    }
    const gymPlanId = gym.planId as Types.ObjectId;
    const gymObjectId = gym._id as Types.ObjectId;

    const [plan, subscription, usageByGym] = await Promise.all([
      db.models.Plan.findById(gymPlanId).lean(),
      db.models.Subscription.findOne({ gymId: gymObjectId }).sort({ createdAt: -1 }).lean(),
      buildGymWhatsAppUsageMap(db, [gym], true),
    ]);

    return {
      ...gym,
      plan,
      subscription,
      whatsappUsage: usageByGym.get(String(gymObjectId)) || null,
    };
  },

  async updateGym(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const gym = await GymModel.findById(id);
    if (!gym) {
      throw new Error("Gym not found");
    }

    if (payload.name !== undefined) gym.name = String(payload.name);
    if (payload.ownerName !== undefined) gym.ownerName = String(payload.ownerName);
    if (payload.phone !== undefined) gym.phone = String(payload.phone);
    if (payload.platformType !== undefined) gym.platformType = String(payload.platformType) as typeof gym.platformType;
    if (payload.city !== undefined) gym.city = String(payload.city);
    if (payload.address !== undefined) gym.address = String(payload.address);
    if (payload.status !== undefined) gym.status = String(payload.status) as typeof gym.status;
    if (payload.waMode !== undefined) gym.waMode = String(payload.waMode) as typeof gym.waMode;
    if (payload.upiId !== undefined) gym.upiId = String(payload.upiId);
    if (payload.gymDisplayName !== undefined) gym.gymDisplayName = String(payload.gymDisplayName);

    if (payload.planId && Types.ObjectId.isValid(String(payload.planId))) {
      const plan = await PlanModel.findById(String(payload.planId));
      if (!plan) {
        throw new Error("Plan not found");
      }
      gym.planId = plan._id;
      await SubscriptionModel.findOneAndUpdate(
        { gymId: gym._id },
        { planId: plan._id },
        { sort: { createdAt: -1 } },
      );
      await WhatsAppUsageMonthlyModel.findOneAndUpdate(
        { gymId: gym._id, monthKey: monthKeyFromDate(new Date()) },
        { $set: { planLimit: plan.whatsappLimit } },
        { upsert: true },
      );
    }

    await gym.save();
    if (payload.ownerName !== undefined || payload.phone !== undefined || payload.platformType !== undefined) {
      const ownerUpdate: Record<string, unknown> = {};
      if (payload.ownerName !== undefined) ownerUpdate.name = String(payload.ownerName);
      if (payload.phone !== undefined) ownerUpdate.phone = String(payload.phone);
      if (payload.platformType !== undefined) ownerUpdate.platformType = String(payload.platformType);
      if (Object.keys(ownerUpdate).length > 0) {
        await UserModel.findByIdAndUpdate(gym.ownerUserId, { $set: ownerUpdate });
      }
    }
    await logAdminAction(req, "Updated Gym", "gym", gym._id.toString());

    return gym.toObject();
  },

  async deleteGym(id: string, req?: Request) {
    const gym = await GymModel.findByIdAndUpdate(id, { status: "suspended" }, { new: true }).lean();
    if (!gym) {
      throw new Error("Gym not found");
    }
    await logAdminAction(req, "Suspended Gym", "gym", id);
    return { id, status: "suspended" };
  },

  async freezeGym(id: string, req?: Request) {
    const gym = await GymModel.findByIdAndUpdate(id, { status: "frozen" }, { new: true }).lean();
    if (!gym) {
      throw new Error("Gym not found");
    }
    await logAdminAction(req, "Frozen Gym", "gym", id);
    return { id, status: gym.status };
  },

  async unfreezeGym(id: string, req?: Request) {
    const gym = await GymModel.findByIdAndUpdate(id, { status: "active" }, { new: true }).lean();
    if (!gym) {
      throw new Error("Gym not found");
    }
    await logAdminAction(req, "Unfrozen Gym", "gym", id);
    return { id, status: gym.status };
  },

  async resetGymWa(id: string, req?: Request) {
    const gym = await GymModel.findById(id).lean();
    if (!gym) {
      throw new Error("Gym not found");
    }

    const updatedUsage = await WhatsAppUsageMonthlyModel.findOneAndUpdate(
      { gymId: gym._id, monthKey: monthKeyFromDate(new Date()) },
      { $set: { messagesUsed: 0, messagesFailed: 0, conversationsCount: 0, deliveryRate: 0, daily: [] } },
      { new: true, upsert: true },
    ).lean();

    await logAdminAction(req, "Reset WhatsApp Usage", "gym", id);
    return { gymId: id, usage: updatedUsage };
  },

  async listPlans(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["name", "billing", "providerPlanId"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.active !== undefined) {
      mongoFilters.active = String(query.filters.active) === "true";
    }
    if (query.filters.billing) {
      mongoFilters.billing = String(query.filters.billing);
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.Plan.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Plan.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async createPlan(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const price = Number(payload.price || 0);
    const isBasic = payload.isBasic !== undefined ? Boolean(payload.isBasic) : false;

    if (isBasic && price > 0) {
      throw new Error("Basic plan price must be 0");
    }
    if (isBasic && payload.active !== undefined && !Boolean(payload.active)) {
      throw new Error("Basic plan must remain active");
    }

    if (isBasic) {
      await PlanModel.updateMany({ isBasic: true }, { $set: { isBasic: false } });
    }

    const plan = await PlanModel.create({
      name: String(payload.name || ""),
      billing: String(payload.billing || "monthly"),
      price,
      isBasic,
      maxMembers: Number(payload.maxMembers || 0),
      whatsappLimit: Number(payload.whatsappLimit || 0),
      features: Array.isArray(payload.features) ? payload.features.map(value => String(value)) : [],
      active: payload.active !== undefined ? Boolean(payload.active) : true,
      providerPlanId: payload.providerPlanId ? String(payload.providerPlanId) : undefined,
      trialDays: payload.trialDays !== undefined ? Number(payload.trialDays) : undefined,
      gracePeriodDays: payload.gracePeriodDays !== undefined ? Number(payload.gracePeriodDays) : undefined,
    });

    await logAdminAction(req, "Created Plan", "plan", plan._id.toString());
    return plan.toObject();
  },

  async updatePlan(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const currentPlan = await PlanModel.findById(id).lean();
    if (!currentPlan) {
      throw new Error("Plan not found");
    }

    const updatePayload: Record<string, unknown> = {};

    ["name", "billing", "providerPlanId"].forEach(key => {
      if (payload[key] !== undefined) updatePayload[key] = String(payload[key]);
    });
    ["price", "maxMembers", "whatsappLimit", "trialDays", "gracePeriodDays"].forEach(key => {
      if (payload[key] !== undefined) updatePayload[key] = Number(payload[key]);
    });
    if (payload.features !== undefined) {
      updatePayload.features = Array.isArray(payload.features)
        ? payload.features.map(item => String(item))
        : [];
    }
    if (payload.active !== undefined) updatePayload.active = Boolean(payload.active);
    if (payload.isBasic !== undefined) updatePayload.isBasic = Boolean(payload.isBasic);

    const nextPrice =
      payload.price !== undefined ? Number(payload.price) : Number(currentPlan.price || 0);
    const nextIsBasic =
      payload.isBasic !== undefined ? Boolean(payload.isBasic) : Boolean(currentPlan.isBasic);
    const nextActive =
      payload.active !== undefined ? Boolean(payload.active) : Boolean(currentPlan.active);

    if (nextIsBasic && nextPrice > 0) {
      throw new Error("Basic plan price must be 0");
    }
    if (nextIsBasic && !nextActive) {
      throw new Error("Basic plan must remain active");
    }
    if (currentPlan.isBasic && payload.isBasic === false) {
      throw new Error("Cannot unset basic plan directly. Set another plan as basic instead.");
    }

    if (payload.isBasic === true) {
      await PlanModel.updateMany({ _id: { $ne: new Types.ObjectId(id) }, isBasic: true }, { $set: { isBasic: false } });
      updatePayload.active = true;
      updatePayload.price = 0;
    }

    const plan = await PlanModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
    if (!plan) {
      throw new Error("Plan not found");
    }
    await logAdminAction(req, "Updated Plan", "plan", id);
    return plan;
  },

  async listSubscriptions(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["gymName", "planName", "status", "paymentStatus"],
    });

    const baseMatch: Record<string, unknown> = {};
    if (query.filters.status) baseMatch.status = String(query.filters.status);
    if (query.filters.paymentStatus) baseMatch.paymentStatus = String(query.filters.paymentStatus);
    if (query.filters.gymId && Types.ObjectId.isValid(String(query.filters.gymId))) {
      baseMatch.gymId = new Types.ObjectId(String(query.filters.gymId));
    }
    if (query.filters.planId && Types.ObjectId.isValid(String(query.filters.planId))) {
      baseMatch.planId = new Types.ObjectId(String(query.filters.planId));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const pipeline: PipelineStage[] = [
      { $match: baseMatch } as PipelineStage,
      {
        $lookup: {
          from: "gyms",
          localField: "gymId",
          foreignField: "_id",
          as: "gym",
        },
      } as PipelineStage,
      { $unwind: { path: "$gym", preserveNullAndEmptyArrays: true } } as PipelineStage,
      {
        $lookup: {
          from: "plans",
          localField: "planId",
          foreignField: "_id",
          as: "plan",
        },
      } as PipelineStage,
      { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } } as PipelineStage,
      {
        $addFields: {
          gymName: "$gym.name",
          planName: "$plan.name",
        },
      } as PipelineStage,
    ];

    if (Object.keys(searchMatch).length > 0) {
      pipeline.push({ $match: searchMatch } as PipelineStage);
    }

    const countPipeline: PipelineStage[] = [...pipeline, { $count: "count" } as PipelineStage];
    const dataPipeline: PipelineStage[] = [...pipeline, { $sort: query.sort } as PipelineStage];

    if (query.projection && Object.keys(query.projection).length > 0) {
      dataPipeline.push({ $project: query.projection } as PipelineStage);
    }
    dataPipeline.push({ $skip: query.skip } as PipelineStage, { $limit: query.itemsPerPage } as PipelineStage);

    const [tableData, countResult] = await Promise.all([
      db.models.Subscription.aggregate(dataPipeline),
      db.models.Subscription.aggregate(countPipeline),
    ]);
    const totalCount = countResult[0]?.count || 0;

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async listSubscriptionPayments(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["paidAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["providerPaymentId", "status", "invoiceUrl"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.status) mongoFilters.status = String(query.filters.status);
    if (query.filters.subscriptionId && Types.ObjectId.isValid(String(query.filters.subscriptionId))) {
      mongoFilters.subscriptionId = new Types.ObjectId(String(query.filters.subscriptionId));
    }
    if (query.filters.gymId && Types.ObjectId.isValid(String(query.filters.gymId))) {
      mongoFilters.gymId = new Types.ObjectId(String(query.filters.gymId));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.SubscriptionPayment.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.SubscriptionPayment.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async revenueStats(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const months = Number(query.months || 6);
    const since = addMonths(toMonthStart(new Date()), -Math.max(months - 1, 0));

    const [monthlyRevenue, planRevenue] = await Promise.all([
      SubscriptionPaymentModel.aggregate([
        { $match: { status: "success", paidAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      SubscriptionPaymentModel.aggregate([
        { $match: { status: "success" } },
        {
          $lookup: {
            from: "subscriptions",
            localField: "subscriptionId",
            foreignField: "_id",
            as: "subscription",
          },
        },
        { $unwind: "$subscription" },
        {
          $lookup: {
            from: "plans",
            localField: "subscription.planId",
            foreignField: "_id",
            as: "plan",
          },
        },
        { $unwind: "$plan" },
        {
          $group: {
            _id: "$plan.name",
            revenue: { $sum: "$amount" },
            payments: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    return {
      monthlyRevenue: monthlyRevenue.map(row => ({
        month: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        revenue: row.revenue,
      })),
      revenueByPlan: planRevenue.map(row => ({
        plan: row._id,
        revenue: row.revenue,
        count: row.payments,
      })),
    };
  },

  async listWhatsAppPhones(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["phone", "qualityRating"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.isActive !== undefined) {
      mongoFilters.isActive = String(query.filters.isActive) === "true";
    }
    if (query.filters.assignedGymId && Types.ObjectId.isValid(String(query.filters.assignedGymId))) {
      mongoFilters.assignedGymId = new Types.ObjectId(String(query.filters.assignedGymId));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.WhatsAppLine.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.WhatsAppLine.countDocuments(finalFilter),
    ]);
    const mappedTableData = tableData.map(line => maskWhatsAppLineForList(line as WhatsAppLineShape));

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData: mappedTableData,
      items: mappedTableData,
    };
  },

  async getWhatsAppPhoneById(id: string, req?: Request) {
    const whatsappLineModel = (req?.db.models.WhatsAppLine as typeof WhatsAppLineModel) || WhatsAppLineModel;
    const line = await whatsappLineModel.findById(id).lean();
    if (!line) {
      throw new Error("WhatsApp line not found");
    }
    return decryptWhatsAppLine(line as WhatsAppLineShape);
  },

  async createWhatsAppPhone(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const assignedGymId = toObjectId(payload.assignedGymId ? String(payload.assignedGymId) : undefined);
    const whatsappLineModel = (req?.db.models.WhatsAppLine as typeof WhatsAppLineModel) || WhatsAppLineModel;
    const phoneNumberId = String(payload.phoneNumberId || "");
    const wabaId = String(payload.wabaId || "");
    const tokenValue = String(payload.tokenEncrypted || payload.token || "");
    const setForBasic = payload.setForBasic !== undefined ? Boolean(payload.setForBasic) : false;

    if (setForBasic) {
      await whatsappLineModel.updateMany({}, { $set: { setForBasic: false } });
    }

    const line = await whatsappLineModel.create({
      phone: String(payload.phone || ""),
      phoneNumberId: encryptFieldValue(phoneNumberId),
      wabaId: encryptFieldValue(wabaId),
      tokenEncrypted: encryptFieldValue(tokenValue),
      setForBasic,
      assignedGymId: assignedGymId || null,
      qualityRating: payload.qualityRating ? String(payload.qualityRating) : undefined,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    });

    await logAdminAction(req, "Created WhatsApp Line", "whatsapp_line", line._id.toString());
    return maskWhatsAppLineForList(line.toObject() as WhatsAppLineShape);
  },

  async updateWhatsAppPhone(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};
    const whatsappLineModel = (req?.db.models.WhatsAppLine as typeof WhatsAppLineModel) || WhatsAppLineModel;

    ["phone", "qualityRating"].forEach(key => {
      if (payload[key] !== undefined) updatePayload[key] = String(payload[key]);
    });
    if (payload.phoneNumberId !== undefined) {
      updatePayload.phoneNumberId = encryptFieldValue(String(payload.phoneNumberId));
    }
    if (payload.wabaId !== undefined) {
      updatePayload.wabaId = encryptFieldValue(String(payload.wabaId));
    }
    if (payload.tokenEncrypted !== undefined || payload.token !== undefined) {
      updatePayload.tokenEncrypted = encryptFieldValue(String(payload.tokenEncrypted || payload.token || ""));
    }
    if (payload.isActive !== undefined) updatePayload.isActive = Boolean(payload.isActive);
    if (payload.setForBasic !== undefined) updatePayload.setForBasic = Boolean(payload.setForBasic);
    if (payload.assignedGymId !== undefined) {
      updatePayload.assignedGymId = toObjectId(String(payload.assignedGymId)) || null;
    }
    if (Boolean(payload.setForBasic)) {
      await whatsappLineModel.updateMany(
        { _id: { $ne: new Types.ObjectId(id) } },
        { $set: { setForBasic: false } },
      );
      updatePayload.isActive = true;
    }

    const line = await whatsappLineModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
    if (!line) {
      throw new Error("WhatsApp line not found");
    }

    await logAdminAction(req, "Updated WhatsApp Line", "whatsapp_line", id);
    return maskWhatsAppLineForList(line as WhatsAppLineShape);
  },

  async listActivityLogs(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["action", "entityType", "entityId", "actorRole"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.gymId && Types.ObjectId.isValid(String(query.filters.gymId))) {
      mongoFilters.gymId = new Types.ObjectId(String(query.filters.gymId));
    }
    if (query.filters.actorUserId && Types.ObjectId.isValid(String(query.filters.actorUserId))) {
      mongoFilters.actorUserId = new Types.ObjectId(String(query.filters.actorUserId));
    }
    if (query.filters.action) {
      mongoFilters.action = { $regex: String(query.filters.action), $options: "i" };
    }
    if (query.filters.entityType) {
      mongoFilters.entityType = String(query.filters.entityType);
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.ActivityLog.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.ActivityLog.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async listAnnouncements(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["sentAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["message", "channel"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.channel) mongoFilters.channel = String(query.filters.channel);
    if (query.filters.sentBy && Types.ObjectId.isValid(String(query.filters.sentBy))) {
      mongoFilters.sentBy = new Types.ObjectId(String(query.filters.sentBy));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [announcementRows, totalCount] = await Promise.all([
      db.models.Announcement.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Announcement.countDocuments(finalFilter),
    ]);

    const senderIds = announcementRows
      .map(row => row.sentBy)
      .filter(value => Boolean(value))
      .map(value => new Types.ObjectId(String(value)));

    const senderRows =
      senderIds.length > 0
        ? await db.models.User.find({ _id: { $in: senderIds } }).select("_id name").lean()
        : [];

    const senderNameMap = new Map<string, string>();
    senderRows.forEach(row => {
      senderNameMap.set(String(row._id), String(row.name || "Admin"));
    });

    const tableData = announcementRows.map(row => ({
      ...row,
      sentByName: senderNameMap.get(String(row.sentBy)) || "Admin",
    }));

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async createAnnouncement(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const actorUserId = req?.authContext?.userId;
    if (!actorUserId || !Types.ObjectId.isValid(actorUserId)) {
      throw new Error("Invalid admin context");
    }
    const announcementModel = (req?.db.models.Announcement as typeof AnnouncementModel) || AnnouncementModel;
    const userModel = (req?.db.models.User as typeof UserModel) || UserModel;
    const whatsappLineModel = (req?.db.models.WhatsAppLine as typeof WhatsAppLineModel) || WhatsAppLineModel;
    const message = String(payload.message || "").trim();
    if (!message) {
      throw new Error("Announcement message is required");
    }

    const allGyms = payload.targetGymIds === "all";
    const targetGymIds = Array.isArray(payload.targetGymIds)
      ? payload.targetGymIds
          .map(value => String(value))
          .filter(value => Types.ObjectId.isValid(value))
          .map(value => new Types.ObjectId(value))
      : [];

    if (!allGyms && targetGymIds.length === 0) {
      throw new Error("Select at least one gym for announcement");
    }

    const basicLine = await whatsappLineModel
      .findOne({ setForBasic: true, isActive: true })
      .select("phone phoneNumberId wabaId tokenEncrypted")
      .lean();
    if (!basicLine) {
      throw new Error("No active WhatsApp line is marked as default for basic announcements");
    }

    const phoneNumberIdEncrypted = encryptFieldValue(String(basicLine.phoneNumberId || ""));
    const wabaIdEncrypted = encryptFieldValue(String(basicLine.wabaId || ""));
    const tokenEncrypted = encryptFieldValue(String(basicLine.tokenEncrypted || ""));
    if (!phoneNumberIdEncrypted || !tokenEncrypted) {
      throw new Error("Default basic WhatsApp line credentials are incomplete");
    }

    const ownerFilter: Record<string, unknown> = {
      role: "gym_owner",
      isActive: true,
      phone: { $exists: true, $ne: "" },
    };
    if (!allGyms) {
      ownerFilter.gymId = { $in: targetGymIds };
    }

    const owners = (await userModel.find(ownerFilter).select("_id gymId name countryCode phone").lean()) as Array<{
      _id: Types.ObjectId;
      gymId?: Types.ObjectId;
      name?: string;
      countryCode?: string;
      phone?: string;
    }>;
    if (owners.length === 0) {
      throw new Error("No gym owners with phone number found for selected targets");
    }

    const notificationText = `${MESSAGE_CONSTANTS.ANNOUNCEMENT_PREFIX}\n${message}`;
    const queueResults = await Promise.all(
      owners.map(async owner => {
        const recipientPhone = composePhoneWithCountryCode(owner.countryCode, owner.phone);
        if (!recipientPhone) {
          return {
            owner,
            recipientPhone,
            status: "failed" as const,
            errorMessage: `Invalid phone for owner ${String(owner.name || owner._id.toString())}`,
          };
        }

        const queuePayload = {
          gymId: owner.gymId?.toString(),
          ownerUserId: owner._id.toString(),
          to: recipientPhone,
          messageType: "text",
          templateName: TEMPLATE_NAMES.ANNOUNCEMENT_BROADCAST,
          message: notificationText,
          variables: {
            announcementMessage: message,
          },
          lineConfig: {
            phone: String(basicLine.phone || ""),
            phoneNumberIdEncrypted,
            wabaIdEncrypted,
            tokenEncrypted,
          },
          correlationId: `announcement:${owner._id.toString()}:${Date.now()}`,
        };

        try {
          await waOutboundQueue.add("announcement-broadcast", queuePayload, {
            jobId: `announcement-broadcast:${owner._id.toString()}:${Date.now()}`,
          });
          return {
            owner,
            recipientPhone,
            status: "queued" as const,
          };
        } catch (error) {
          return {
            owner,
            recipientPhone,
            status: "failed" as const,
            errorMessage: (error as Error).message || "queue failed",
          };
        }
      }),
    );

    const outgoingRecords = queueResults.map(result => ({
      gymId: result.owner.gymId && Types.ObjectId.isValid(String(result.owner.gymId))
        ? new Types.ObjectId(String(result.owner.gymId))
        : undefined,
      sentBy: new Types.ObjectId(actorUserId),
      sentByRole: "admin",
      channel: "whatsapp",
      direction: "outbound",
      source: "announcement",
      content: notificationText,
      recipientPhone: result.recipientPhone || String(result.owner.phone || ""),
      phoneUsed: String(basicLine.phone || ""),
      phoneNumberIdUsed: phoneNumberIdEncrypted,
      wabaIdUsed: wabaIdEncrypted,
      status: result.status,
      error: result.status === "failed" ? result.errorMessage : undefined,
      meta: {
        announcementMessage: message,
        ownerUserId: result.owner._id.toString(),
        targetGymScope: allGyms ? "all" : "selected",
      },
    }));
    await persistOutgoingMessages(req, outgoingRecords);

    const queuedCount = queueResults.filter(result => result.status === "queued").length;
    const failedMessages = queueResults
      .filter(result => result.status === "failed")
      .map(result => `${result.owner.phone}: ${result.errorMessage || "queue failed"}`);

    if (queuedCount === 0) {
      throw new Error(`Failed to queue announcement notifications. ${failedMessages.slice(0, 3).join(" | ")}`);
    }

    const announcement = await announcementModel.create({
      message,
      targetGymIds: allGyms ? "all" : targetGymIds,
      sentBy: new Types.ObjectId(actorUserId),
      sentAt: new Date(),
      channel: "whatsapp",
    });

    await logAdminAction(req, "Created Announcement", "announcement", announcement._id.toString(), {
      recipientCount: owners.length,
      sentCount: queuedCount,
      failedCount: failedMessages.length,
    });

    return {
      ...announcement.toObject(),
      notificationSummary: {
        recipientCount: owners.length,
        sentCount: queuedCount,
        failedCount: failedMessages.length,
        failedMessages,
      },
    };
  },

  async listEnquiries(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["name", "gymName", "city", "phone", "email", "message"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.status) mongoFilters.status = String(query.filters.status);

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.Enquiry.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Enquiry.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async updateEnquiry(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};

    if (payload.status !== undefined) {
      const status = String(payload.status);
      if (!["new", "contacted", "closed"].includes(status)) {
        throw new Error("Invalid enquiry status");
      }
      updatePayload.status = status;
    }

    if (payload.assignedTo !== undefined) {
      const assignedTo = String(payload.assignedTo || "");
      updatePayload.assignedTo = Types.ObjectId.isValid(assignedTo) ? new Types.ObjectId(assignedTo) : undefined;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error("No valid enquiry updates provided");
    }

    const enquiry = await EnquiryModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
    if (!enquiry) {
      throw new Error("Enquiry not found");
    }

    await logAdminAction(req, "Updated Enquiry", "enquiry", id, updatePayload);
    return enquiry;
  },

  async listOwnerSupport(rawQuery: unknown, db: Connection) {
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["lastUpdatedAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["subject", "message", "status", "priority"],
    });

    const mongoFilters: Record<string, unknown> = {};
    if (query.filters.status) mongoFilters.status = String(query.filters.status);
    if (query.filters.priority) mongoFilters.priority = String(query.filters.priority);
    if (query.filters.gymId && Types.ObjectId.isValid(String(query.filters.gymId))) {
      mongoFilters.gymId = new Types.ObjectId(String(query.filters.gymId));
    }

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [mongoFilters, searchMatch] }
        : mongoFilters;

    const [tableData, totalCount] = await Promise.all([
      db.models.SupportTicket.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.SupportTicket.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData,
      items: tableData,
    };
  },

  async updateOwnerSupport(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const ticket = await SupportTicketModel.findById(id);
    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    if (payload.status !== undefined) {
      const status = String(payload.status);
      if (!["open", "in_progress", "resolved"].includes(status)) {
        throw new Error("Invalid support status");
      }
      ticket.status = status as typeof ticket.status;
    }

    const replyMessage = typeof payload.replyMessage === "string" ? payload.replyMessage.trim() : "";
    if (replyMessage) {
      ticket.replies.push({
        sender: "admin",
        senderName: "Admin",
        message: replyMessage,
        timestamp: new Date(),
      });
    }

    ticket.lastUpdatedAt = new Date();
    await ticket.save();

    await logAdminAction(req, "Updated Support Ticket", "support_ticket", id, {
      status: ticket.status,
      replied: Boolean(replyMessage),
    });
    return ticket.toObject();
  },
};
