import { Request } from "express";
import { Types } from "mongoose";
import { parsePagination, monthKeyFromDate } from "../../../../common/utils/query";
import { hashPassword } from "../../../../common/utils/password";
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
  const actorUserId = (req as any)?.authContext?.userId;
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

const toMonthStart = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
};

const addMonths = (date: Date, months: number): Date => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};

export const adminCore = {
  async listGyms(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const { limit, skip, page } = parsePagination(query);
    const filters: Record<string, unknown> = {};

    if (query.status) {
      filters.status = String(query.status);
    }
    if (query.planId && Types.ObjectId.isValid(String(query.planId))) {
      filters.planId = new Types.ObjectId(String(query.planId));
    }
    if (query.search) {
      const keyword = String(query.search).trim();
      filters.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { ownerName: { $regex: keyword, $options: "i" } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      GymModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      GymModel.countDocuments(filters),
    ]);

    return { totalCount, page, limit, items };
  },

  async createGym(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const planId = String(payload.planId || "");
    const plan = await PlanModel.findById(planId);
    if (!plan) {
      throw new Error("Selected plan does not exist");
    }

    const now = new Date();
    const startDate = payload.startDate ? new Date(String(payload.startDate)) : now;
    const expiryDate =
      payload.expiryDate && !Number.isNaN(new Date(String(payload.expiryDate)).getTime())
        ? new Date(String(payload.expiryDate))
        : addMonths(startDate, plan.billing === "monthly" ? 1 : 12);

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

    const ownerUser = await UserModel.create({
      email: ownerEmail,
      phone: String(payload.phone || ""),
      passwordHash: hashPassword(ownerPassword),
      role: "gym_owner",
      isActive: true,
    });

    const gym = await GymModel.create({
      name: String(payload.name || ""),
      ownerName: String(payload.ownerName || ""),
      ownerUserId: ownerUser._id,
      phone: String(payload.phone || ""),
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

    await logAdminAction(req, "Created Gym", "gym", gym._id.toString(), { planId: plan._id.toString() });

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

  async getGymById(id: string) {
    const gym = await GymModel.findById(id).lean();
    if (!gym) {
      throw new Error("Gym not found");
    }

    const [plan, subscription, currentUsage] = await Promise.all([
      PlanModel.findById(gym.planId).lean(),
      SubscriptionModel.findOne({ gymId: gym._id }).sort({ createdAt: -1 }).lean(),
      WhatsAppUsageMonthlyModel.findOne({ gymId: gym._id, monthKey: monthKeyFromDate(new Date()) }).lean(),
    ]);

    return {
      ...gym,
      plan,
      subscription,
      whatsappUsage: currentUsage,
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

  async listPlans() {
    const plans = await PlanModel.find().sort({ createdAt: -1 }).lean();
    return { totalCount: plans.length, items: plans };
  },

  async createPlan(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const plan = await PlanModel.create({
      name: String(payload.name || ""),
      billing: String(payload.billing || "monthly"),
      price: Number(payload.price || 0),
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

    const plan = await PlanModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
    if (!plan) {
      throw new Error("Plan not found");
    }
    await logAdminAction(req, "Updated Plan", "plan", id);
    return plan;
  },

  async listSubscriptions(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const { limit, skip, page } = parsePagination(query);
    const filters: Record<string, unknown> = {};

    if (query.status) filters.status = String(query.status);
    if (query.paymentStatus) filters.paymentStatus = String(query.paymentStatus);

    const [items, totalCount] = await Promise.all([
      SubscriptionModel.find(filters)
        .populate("gymId")
        .populate("planId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubscriptionModel.countDocuments(filters),
    ]);

    return { totalCount, page, limit, items };
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

  async listWhatsAppPhones() {
    const items = await WhatsAppLineModel.find().sort({ createdAt: -1 }).lean();
    return { totalCount: items.length, items };
  },

  async createWhatsAppPhone(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const assignedGymId = toObjectId(payload.assignedGymId ? String(payload.assignedGymId) : undefined);

    const line = await WhatsAppLineModel.create({
      phone: String(payload.phone || ""),
      phoneNumberId: String(payload.phoneNumberId || ""),
      wabaId: String(payload.wabaId || ""),
      tokenEncrypted: String(payload.tokenEncrypted || ""),
      assignedGymId: assignedGymId || null,
      qualityRating: payload.qualityRating ? String(payload.qualityRating) : undefined,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    });

    await logAdminAction(req, "Created WhatsApp Line", "whatsapp_line", line._id.toString());
    return line.toObject();
  },

  async updateWhatsAppPhone(id: string, rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};
    ["phone", "phoneNumberId", "wabaId", "tokenEncrypted", "qualityRating"].forEach(key => {
      if (payload[key] !== undefined) updatePayload[key] = String(payload[key]);
    });
    if (payload.isActive !== undefined) updatePayload.isActive = Boolean(payload.isActive);
    if (payload.assignedGymId !== undefined) {
      updatePayload.assignedGymId = toObjectId(String(payload.assignedGymId)) || null;
    }

    const line = await WhatsAppLineModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean();
    if (!line) {
      throw new Error("WhatsApp line not found");
    }

    await logAdminAction(req, "Updated WhatsApp Line", "whatsapp_line", id);
    return line;
  },

  async listActivityLogs(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const { limit, skip, page } = parsePagination(query);
    const filters: Record<string, unknown> = {};

    if (query.gymId && Types.ObjectId.isValid(String(query.gymId))) {
      filters.gymId = new Types.ObjectId(String(query.gymId));
    }
    if (query.actorUserId && Types.ObjectId.isValid(String(query.actorUserId))) {
      filters.actorUserId = new Types.ObjectId(String(query.actorUserId));
    }
    if (query.action) {
      filters.action = { $regex: String(query.action), $options: "i" };
    }

    const [items, totalCount] = await Promise.all([
      ActivityLogModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLogModel.countDocuments(filters),
    ]);

    return { totalCount, page, limit, items };
  },

  async listAnnouncements() {
    const items = await AnnouncementModel.find().sort({ sentAt: -1 }).lean();
    return { totalCount: items.length, items };
  },

  async createAnnouncement(rawPayload: unknown, req?: Request) {
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const actorUserId = (req as any)?.authContext?.userId;
    if (!actorUserId || !Types.ObjectId.isValid(actorUserId)) {
      throw new Error("Invalid admin context");
    }

    const announcement = await AnnouncementModel.create({
      message: String(payload.message || ""),
      targetGymIds: payload.targetGymIds === "all" ? "all" : payload.targetGymIds || [],
      sentBy: new Types.ObjectId(actorUserId),
      sentAt: new Date(),
      channel: payload.channel ? String(payload.channel) : "in_app",
    });

    await logAdminAction(req, "Created Announcement", "announcement", announcement._id.toString());
    return announcement.toObject();
  },

  async listEnquiries(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const { limit, skip, page } = parsePagination(query);
    const filters: Record<string, unknown> = {};

    if (query.status) filters.status = String(query.status);
    if (query.search) {
      const keyword = String(query.search);
      filters.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { gymName: { $regex: keyword, $options: "i" } },
        { city: { $regex: keyword, $options: "i" } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      EnquiryModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EnquiryModel.countDocuments(filters),
    ]);
    return { totalCount, page, limit, items };
  },

  async listOwnerSupport(rawQuery: unknown) {
    const query = (rawQuery || {}) as QueryInput;
    const { limit, skip, page } = parsePagination(query);
    const filters: Record<string, unknown> = {};

    if (query.status) filters.status = String(query.status);
    if (query.priority) filters.priority = String(query.priority);
    if (query.gymId && Types.ObjectId.isValid(String(query.gymId))) {
      filters.gymId = new Types.ObjectId(String(query.gymId));
    }

    const [items, totalCount] = await Promise.all([
      SupportTicketModel.find(filters).sort({ lastUpdatedAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicketModel.countDocuments(filters),
    ]);
    return { totalCount, page, limit, items };
  },
};
