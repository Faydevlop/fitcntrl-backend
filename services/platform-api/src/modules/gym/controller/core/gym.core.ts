import { Connection, Types } from "mongoose";
import { monthKeyFromDate } from "../../../../common/utils/query";
import { normalizeTableQuery, buildTableSearchMatch } from "../../../../common/utils/table-query";
import { GymModel } from "../../../admin/model/gym.model";
import { PlanModel } from "../../../admin/model/plan.model";
import { SubscriptionModel } from "../../../admin/model/subscription.model";
import { SubscriptionPaymentModel } from "../../../admin/model/subscription-payment.model";
import { SupportTicketModel } from "../../../admin/model/support-ticket.model";
import { WhatsAppUsageMonthlyModel } from "../../../admin/model/whatsapp-usage-monthly.model";
import { MemberModel } from "../../model/member.model";
import { MemberPaymentModel } from "../../model/member-payment.model";
import { waOutboundQueue } from "../../../../bootstrap/queues";
import { ActivityLogModel } from "../../../admin/model/activity-log.model";
import { WhatsAppLineModel } from "../../../admin/model/whatsapp-line.model";
import { MessageModel } from "../../../admin/model/message.model";
import { UserModel } from "../../../auth/model/user.model";
import { logger } from "../../../../common/logger/app-logger";
import { encryptFieldValue } from "../../../../common/utils/field-crypto";
import { composePhoneWithCountryCode, normalizeCountryCode } from "../../../../common/utils/phone";
import { getTemplateConfig, TEMPLATE_NAMES } from "../../../../common/constants/templates";

type QueryInput = Record<string, unknown>;
type AuthContext = { userId?: string; gymId?: string; role?: string } | undefined;

const assertGymId = (auth: AuthContext): Types.ObjectId => {
  const gymId = auth?.gymId;
  if (!gymId || !Types.ObjectId.isValid(gymId)) {
    throw new Error("Gym context is required");
  }
  return new Types.ObjectId(gymId);
};

const parseDate = (value: unknown, fallback: Date): Date => {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
};

const toMonthFirstUtc = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));

const nextDueByPlan = (startDate: Date, plan: string): Date => {
  const due = toMonthFirstUtc(startDate);
  const normalizedPlan = plan.toLowerCase();
  if (normalizedPlan === "quarterly") {
    due.setUTCMonth(due.getUTCMonth() + 3);
  } else if (normalizedPlan === "yearly") {
    due.setUTCFullYear(due.getUTCFullYear() + 1);
  } else {
    due.setUTCMonth(due.getUTCMonth() + 1);
  }
  return due;
};

const nextMonthFirst = (startDate: Date): Date => {
  const due = toMonthFirstUtc(startDate);
  due.setUTCMonth(due.getUTCMonth() + 1);
  return due;
};

const getMonthLabel = (date: Date): string => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const logGymAction = async (
  auth: AuthContext,
  gymId: Types.ObjectId,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> => {
  const userId = auth?.userId;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return;
  }

  await ActivityLogModel.create({
    actorUserId: new Types.ObjectId(userId),
    actorRole: "gym_owner",
    gymId,
    action,
    entityType,
    entityId,
    meta,
  });
};

const refreshMemberCounts = async (gymId: Types.ObjectId): Promise<void> => {
  const grouped = await MemberModel.aggregate([
    { $match: { gymId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = {
    total: 0,
    active: 0,
    paused: 0,
    expired: 0,
    blacklisted: 0,
  };

  grouped.forEach(row => {
    const key = String(row._id) as keyof typeof counts;
    if (counts[key] !== undefined) {
      counts[key] = row.count;
    }
    counts.total += row.count;
  });

  await GymModel.findByIdAndUpdate(gymId, { $set: { memberCounts: counts } });
};

const assertSubscriptionUsable = async (gymId: Types.ObjectId): Promise<void> => {
  const gym = await GymModel.findById(gymId).select("status subscription planId").lean();
  if (!gym) {
    throw new Error("Gym not found");
  }

  if (gym.status === "frozen" || gym.status === "suspended") {
    throw new Error("Your account is currently restricted. Please contact support.");
  }

  const expiryDate = gym.subscription?.expiryDate ? new Date(gym.subscription.expiryDate) : null;
  if (expiryDate && expiryDate.getTime() < Date.now()) {
    const plan = await PlanModel.findById(gym.planId).select("name isBasic").lean();
    await GymModel.updateOne({ _id: gymId }, { $set: { status: "suspended" } }).catch(() => undefined);

    if (plan?.isBasic) {
      throw new Error(
        "Your Basic plan is valid for 2 months and has expired. Please upgrade your plan to continue.",
      );
    }

    throw new Error(
      `Your ${plan?.name || "current"} subscription has expired. Please renew or upgrade to continue.`,
    );
  }
};

const getGymPlanForLimits = async (gymId: Types.ObjectId) => {
  const gym = await GymModel.findById(gymId).select("planId").lean();
  if (!gym?.planId) {
    throw new Error("Gym plan is not configured");
  }

  const plan = await PlanModel.findById(gym.planId)
    .select("name maxMembers whatsappLimit isBasic")
    .lean();
  if (!plan) {
    throw new Error("Plan not found for this gym");
  }

  return plan;
};

type EncryptedLineConfig = {
  phone: string;
  phoneNumberIdEncrypted: string;
  wabaIdEncrypted: string;
  tokenEncrypted: string;
};

const getOutboundLineConfigForGym = async (
  gymId: Types.ObjectId,
  isBasicPlan: boolean,
): Promise<EncryptedLineConfig | null> => {
  const gym = await GymModel.findById(gymId).select("waMode").lean();
  if (!gym) {
    return null;
  }

  let line: {
    phone?: string;
    phoneNumberId?: string;
    wabaId?: string;
    tokenEncrypted?: string;
  } | null = null;

  if (!isBasicPlan && gym.waMode === "dedicated") {
    line = await WhatsAppLineModel.findOne({ assignedGymId: gymId, isActive: true })
      .select("phone phoneNumberId wabaId tokenEncrypted")
      .lean();
  }

  if (!line) {
    line = await WhatsAppLineModel.findOne({ setForBasic: true, isActive: true })
      .select("phone phoneNumberId wabaId tokenEncrypted")
      .lean();
  }

  if (!line) {
    return null;
  }

  return {
    phone: String(line.phone || ""),
    phoneNumberIdEncrypted: encryptFieldValue(String(line.phoneNumberId || "")),
    wabaIdEncrypted: encryptFieldValue(String(line.wabaId || "")),
    tokenEncrypted: encryptFieldValue(String(line.tokenEncrypted || "")),
  };
};

const reserveWhatsAppQuota = async (gymId: Types.ObjectId, planLimit: number): Promise<void> => {
  if (!Number.isFinite(planLimit) || planLimit <= 0) {
    throw new Error("WhatsApp message limit for your current plan is 0. Please upgrade your plan.");
  }

  const monthKey = monthKeyFromDate(new Date());
  await WhatsAppUsageMonthlyModel.findOneAndUpdate(
    { gymId, monthKey },
    {
      $setOnInsert: {
        gymId,
        monthKey,
        planLimit,
        messagesUsed: 0,
        messagesFailed: 0,
        conversationsCount: 0,
        deliveryRate: 0,
        daily: [],
      },
      $set: { planLimit },
    },
    { upsert: true, new: true },
  );

  const consumed = await WhatsAppUsageMonthlyModel.findOneAndUpdate(
    { gymId, monthKey, messagesUsed: { $lt: planLimit } },
    { $inc: { messagesUsed: 1 } },
    { new: true },
  ).lean();

  if (!consumed) {
    throw new Error(`WhatsApp monthly message limit reached (${planLimit}).`);
  }
};

const releaseWhatsAppQuota = async (gymId: Types.ObjectId): Promise<void> => {
  const monthKey = monthKeyFromDate(new Date());
  await WhatsAppUsageMonthlyModel.updateOne(
    { gymId, monthKey, messagesUsed: { $gt: 0 } },
    { $inc: { messagesUsed: -1 } },
  );
};

const incrementDailySentUsage = async (gymId: Types.ObjectId): Promise<void> => {
  const monthKey = monthKeyFromDate(new Date());
  const date = new Date().toISOString().split("T")[0];

  const existingDay = await WhatsAppUsageMonthlyModel.updateOne(
    { gymId, monthKey, "daily.date": date },
    { $inc: { "daily.$.sent": 1 } },
  );

  if (existingDay.modifiedCount === 0) {
    await WhatsAppUsageMonthlyModel.updateOne(
      { gymId, monthKey },
      {
        $push: {
          daily: {
            date,
            sent: 1,
            failed: 0,
            conversations: 0,
          },
        },
      },
    );
  }
};

const persistOutgoingMessage = async (db: Connection | undefined, record: Record<string, unknown>) => {
  const messageModel = (db?.models.Message as typeof MessageModel) || MessageModel;
  try {
    await messageModel.create(record);
  } catch (error) {
    logger.warn("Failed to write outgoing message log", {
      source: record.source,
      status: record.status,
      error: (error as Error).message,
    });
  }
};

export const gymCore = {
  async dashboardStats(context: unknown) {
    const payload = context as { auth?: AuthContext };
    const gymId = assertGymId(payload.auth);
    const now = new Date();
    const monthKey = monthKeyFromDate(now);

    const [
      totalMembers,
      activeMembers,
      pendingMembersCount,
      pendingAmountAgg,
      revenueAgg,
      pendingMembers,
      usage,
      gym,
      subscription,
    ] = await Promise.all([
      MemberModel.countDocuments({ gymId }),
      MemberModel.countDocuments({ gymId, status: { $in: ["active", "paused"] } }),
      MemberModel.countDocuments({ gymId, paymentStatus: "pending" }),
      MemberModel.aggregate([
        { $match: { gymId, paymentStatus: "pending" } },
        { $group: { _id: null, amount: { $sum: "$fee" } } },
      ]),
      MemberPaymentModel.aggregate([
        { $match: { gymId } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      MemberModel.find({ gymId, paymentStatus: "pending" })
        .sort({ nextDueDate: 1 })
        .limit(5)
        .select("name phone fee nextDueDate")
        .lean(),
      WhatsAppUsageMonthlyModel.findOne({ gymId, monthKey }).lean(),
      GymModel.findById(gymId).lean(),
      SubscriptionModel.findOne({ gymId }).sort({ createdAt: -1 }).lean(),
    ]);

    return {
      totalMembers,
      activeMembers,
      pendingMembersCount,
      pendingAmount: pendingAmountAgg[0]?.amount || 0,
      totalRevenue: revenueAgg[0]?.amount || 0,
      pendingMembers,
      whatsappUsage: usage || null,
      gymStatus: gym?.status || null,
      subscriptionStatus: subscription?.status || null,
    };
  },

  async dashboardGrowth(context: unknown) {
    const payload = context as { auth?: AuthContext; query?: QueryInput };
    const gymId = assertGymId(payload.auth);
    const months = Math.max(1, Math.min(Number(payload.query?.months || 6), 24));
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - (months - 1));
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);

    const rows = await MemberModel.aggregate([
      { $match: { gymId, joinDate: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: "$joinDate" },
            month: { $month: "$joinDate" },
          },
          joined: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      totalCount: rows.length,
      items: rows.map(row => ({
        month: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        joined: row.joined,
      })),
    };
  },

  async listMembers(rawQuery: unknown, auth: AuthContext, db: Connection) {
    const gymId = assertGymId(auth);
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["createdAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["name", "phone", "plan", "status", "paymentStatus"],
    });
    const filters: Record<string, unknown> = { gymId };

    if (query.filters.status) filters.status = String(query.filters.status);
    if (query.filters.paymentStatus) filters.paymentStatus = String(query.filters.paymentStatus);
    if (query.filters.plan) filters.plan = String(query.filters.plan);

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [filters, searchMatch] }
        : filters;

    const [tableData, totalCount] = await Promise.all([
      db.models.Member.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Member.countDocuments(finalFilter),
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

  async createMember(rawPayload: unknown, auth: AuthContext, db?: Connection) {
    const gymId = assertGymId(auth);
    await assertSubscriptionUsable(gymId);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const joinDate = parseDate(payload.joinDate, new Date());
    if (payload.plan !== undefined && String(payload.plan).toLowerCase() !== "monthly") {
      throw new Error("Only monthly member plan is supported.");
    }
    const plan = await getGymPlanForLimits(gymId);

    const currentMemberCount = await MemberModel.countDocuments({
      gymId,
      status: { $ne: "blacklisted" },
    });
    if (currentMemberCount >= Number(plan.maxMembers || 0)) {
      throw new Error(
        `Member limit reached for your current plan (${plan.name}). Max allowed: ${plan.maxMembers}. Please upgrade your plan.`,
      );
    }

    await reserveWhatsAppQuota(gymId, Number(plan.whatsappLimit || 0));
    let quotaConsumed = true;

    try {
      const member = await MemberModel.create({
        gymId,
        name: String(payload.name || ""),
        countryCode: normalizeCountryCode(
          typeof payload.countryCode === "string" ? payload.countryCode : undefined,
        ),
        phone: String(payload.phone || ""),
        plan: "monthly",
        fee: Number(payload.fee || 0),
        joinDate,
        nextDueDate: nextMonthFirst(joinDate),
        status: payload.status ? String(payload.status) : "active",
        paymentStatus: payload.paymentStatus ? String(payload.paymentStatus) : "pending",
        notes: payload.notes ? String(payload.notes) : "",
      });

      const ownerFallback = await UserModel.findOne({ gymId, role: "gym_owner" }).select("_id").lean();
      const ownerUserId =
        auth?.userId && Types.ObjectId.isValid(auth.userId)
          ? new Types.ObjectId(auth.userId)
          : ownerFallback?._id || new Types.ObjectId();
      const outboundLineConfig = await getOutboundLineConfigForGym(gymId, Boolean(plan.isBasic));
      const gym = await GymModel.findById(gymId).select("name gymDisplayName").lean();
      const gymName = String(gym?.gymDisplayName || gym?.name || "FitCntrl");
      const memberWelcomeTemplate = getTemplateConfig(TEMPLATE_NAMES.MEMBER_WELCOME);
      const recipientPhone = composePhoneWithCountryCode(member.countryCode, member.phone);
      const queuePayload = {
        gymId: gymId.toString(),
        memberId: member._id.toString(),
        ownerUserId: ownerFallback?._id?.toString() || ownerUserId.toString(),
        to: recipientPhone,
        messageType: "template",
        templateName: memberWelcomeTemplate.name,
        language: memberWelcomeTemplate.language,
        category: memberWelcomeTemplate.category,
        variables: {
          memberName: member.name,
          gymName,
        },
        templateVariables: [member.name, gymName],
        template: {
          name: memberWelcomeTemplate.name,
          language: memberWelcomeTemplate.language,
          category: memberWelcomeTemplate.category,
          components: [
            {
              type: "BODY",
              text: memberWelcomeTemplate.bodyText,
            },
          ],
        },
        correlationId: `member-welcome:${member._id.toString()}`,
        lineConfig: outboundLineConfig || undefined,
      };
      const welcomeContent = `Hi ${member.name} Welcome to ${gymName}! Your membership has been activated successfully.`;

      try {
        if (!outboundLineConfig) {
          logger.warn("No active WhatsApp sender line configured for this gym.", {
            gymId: gymId.toString(),
            memberId: member._id.toString(),
            templateName: memberWelcomeTemplate.name,
          });
        }

        await waOutboundQueue.add("member-welcome", queuePayload, {
          jobId: `member-welcome:${member._id.toString()}`,
        });
        await incrementDailySentUsage(gymId);
        await persistOutgoingMessage(db, {
          gymId,
          sentBy: ownerUserId,
          sentByRole: auth?.role === "admin" ? "admin" : "gym_owner",
          channel: "whatsapp",
          direction: "outbound",
          source: "member_welcome",
          content: welcomeContent,
          recipientPhone,
          phoneUsed: outboundLineConfig?.phone,
          phoneNumberIdUsed: outboundLineConfig?.phoneNumberIdEncrypted,
          wabaIdUsed: outboundLineConfig?.wabaIdEncrypted,
          status: "queued",
          meta: {
            memberId: member._id.toString(),
            templateName: memberWelcomeTemplate.name,
            language: memberWelcomeTemplate.language,
            category: memberWelcomeTemplate.category,
            templateVariables: [member.name, gymName],
          },
        });
      } catch (error) {
        await releaseWhatsAppQuota(gymId);
        quotaConsumed = false;
        await persistOutgoingMessage(db, {
          gymId,
          sentBy: ownerUserId,
          sentByRole: auth?.role === "admin" ? "admin" : "gym_owner",
          channel: "whatsapp",
          direction: "outbound",
          source: "member_welcome",
          content: welcomeContent,
          recipientPhone,
          phoneUsed: outboundLineConfig?.phone,
          phoneNumberIdUsed: outboundLineConfig?.phoneNumberIdEncrypted,
          wabaIdUsed: outboundLineConfig?.wabaIdEncrypted,
          status: "failed",
          error: (error as Error).message,
          meta: {
            memberId: member._id.toString(),
            templateName: memberWelcomeTemplate.name,
            language: memberWelcomeTemplate.language,
            category: memberWelcomeTemplate.category,
            templateVariables: [member.name, gymName],
          },
        });
        logger.warn("Member created but welcome message queueing failed", {
          gymId: gymId.toString(),
          memberId: member._id.toString(),
          error: (error as Error).message,
        });
      }

      await refreshMemberCounts(gymId);
      await logGymAction(auth, gymId, "Created Member", "member", member._id.toString());

      return member.toObject();
    } catch (error) {
      if (quotaConsumed) {
        await releaseWhatsAppQuota(gymId);
      }
      throw error;
    }
  },

  async getMemberById(id: string, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const member = await MemberModel.findOne({ _id: id, gymId }).lean();
    if (!member) {
      throw new Error("Member not found");
    }

    const payments = await MemberPaymentModel.find({ gymId, memberId: member._id })
      .sort({ paidDate: -1 })
      .lean();
    return { ...member, payments };
  },

  async updateMember(id: string, rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    await assertSubscriptionUsable(gymId);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const member = await MemberModel.findOne({ _id: id, gymId });
    if (!member) {
      throw new Error("Member not found");
    }

    if (payload.name !== undefined) member.name = String(payload.name);
    if (payload.countryCode !== undefined) {
      member.countryCode = normalizeCountryCode(String(payload.countryCode));
    }
    if (payload.phone !== undefined) member.phone = String(payload.phone);
    if (payload.plan !== undefined && String(payload.plan).toLowerCase() !== "monthly") {
      throw new Error("Member plan is fixed to monthly and cannot be changed.");
    }
    member.plan = "monthly";
    if (payload.fee !== undefined) member.fee = Number(payload.fee);
    if (payload.nextDueDate !== undefined) {
      const requestedDueDate = parseDate(payload.nextDueDate, member.nextDueDate);
      if (requestedDueDate.getUTCDate() !== 1) {
        throw new Error(
          "Scheduled notifications run on every month's 1st. Please set next due date to the 1st.",
        );
      }
      member.nextDueDate = toMonthFirstUtc(requestedDueDate);
    }
    if (payload.status !== undefined) member.status = String(payload.status) as typeof member.status;
    if (payload.paymentStatus !== undefined)
      member.paymentStatus = String(payload.paymentStatus) as typeof member.paymentStatus;
    if (payload.notes !== undefined) member.notes = String(payload.notes);

    await member.save();
    await refreshMemberCounts(gymId);
    await logGymAction(auth, gymId, "Updated Member", "member", member._id.toString());

    return member.toObject();
  },

  async deleteMember(id: string, auth: AuthContext) {
    const gymId = assertGymId(auth);
    await assertSubscriptionUsable(gymId);
    const member = await MemberModel.findOneAndUpdate(
      { _id: id, gymId },
      { $set: { status: "blacklisted", paymentStatus: "pending" } },
      { new: true },
    ).lean();
    if (!member) {
      throw new Error("Member not found");
    }
    await refreshMemberCounts(gymId);
    await logGymAction(auth, gymId, "Blacklisted Member", "member", id);
    return { id, status: member.status };
  },

  async listPayments(rawQuery: unknown, auth: AuthContext, db: Connection) {
    const gymId = assertGymId(auth);
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["paidDate"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["memberName", "memberPhone", "monthLabel", "method"],
    });
    const filters: Record<string, unknown> = { gymId };

    if (query.filters.memberId && Types.ObjectId.isValid(String(query.filters.memberId))) {
      filters.memberId = new Types.ObjectId(String(query.filters.memberId));
    }
    if (query.filters.method) filters.method = String(query.filters.method);

    const memberSearchItems = query.search
      .map(item => {
        const mappedFields = (item.fields || [])
          .map(field => {
            if (field === "memberName" || field === "name") return "name";
            if (field === "memberPhone" || field === "phone") return "phone";
            return "";
          })
          .filter(Boolean);
        return { ...item, fields: mappedFields };
      })
      .filter(item => (item.fields || []).length > 0);

    const paymentSearchItems = query.search
      .map(item => {
        const fields = (item.fields || []).filter(
          field =>
            field !== "memberName" && field !== "name" && field !== "memberPhone" && field !== "phone",
        );
        return { ...item, fields };
      })
      .filter(item => (item.fields || []).length > 0);

    const andFilterParts: Record<string, unknown>[] = [filters];
    if (query.search.length > 0) {
      const memberSearchMatch = buildTableSearchMatch(memberSearchItems);
      if (Object.keys(memberSearchMatch).length > 0) {
        const members = await db.models.Member.find({ gymId, ...memberSearchMatch }).select("_id").lean();
        andFilterParts.push({ memberId: { $in: members.map(member => member._id) } });
      }

      const paymentSearchMatch = buildTableSearchMatch(paymentSearchItems);
      if (Object.keys(paymentSearchMatch).length > 0) {
        andFilterParts.push(paymentSearchMatch);
      }
    }

    const finalFilter = andFilterParts.length > 1 ? { $and: andFilterParts } : andFilterParts[0];

    const [tableData, totalCount] = await Promise.all([
      db.models.MemberPayment.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.MemberPayment.countDocuments(finalFilter),
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

  async createPayment(rawPayload: unknown, auth: AuthContext, db?: Connection) {
    const gymId = assertGymId(auth);
    await assertSubscriptionUsable(gymId);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const plan = await getGymPlanForLimits(gymId);
    const outboundLineConfig = await getOutboundLineConfigForGym(gymId, Boolean(plan.isBasic));
    await reserveWhatsAppQuota(gymId, Number(plan.whatsappLimit || 0));
    let quotaConsumed = true;

    try {
      const memberId = String(payload.memberId || "");
      const member = await MemberModel.findOne({ _id: memberId, gymId });
      if (!member) {
        throw new Error("Member not found");
      }

      const paidDate = parseDate(payload.paidDate, new Date());
      const amount = Number(payload.amount || 0);
      const ownerFallback = await UserModel.findOne({ gymId, role: "gym_owner" }).select("_id").lean();
      const receivedByUserId =
        auth?.userId && Types.ObjectId.isValid(auth.userId)
          ? new Types.ObjectId(auth.userId)
          : ownerFallback?._id || new Types.ObjectId();

      const payment = await MemberPaymentModel.create({
        gymId,
        memberId: member._id,
        amount,
        paidDate,
        monthLabel: payload.monthLabel ? String(payload.monthLabel) : getMonthLabel(paidDate),
        method: String(payload.method || "cash"),
        isPartial: payload.isPartial !== undefined ? Boolean(payload.isPartial) : false,
        notes: payload.notes ? String(payload.notes) : undefined,
        receivedByUserId,
      });

      member.paymentStatus = "paid";
      member.lastPaymentDate = paidDate;
      member.lastPaymentMethod = String(payload.method || "cash") as typeof member.lastPaymentMethod;
      member.nextDueDate = nextDueByPlan(paidDate, member.plan);
      await member.save();

      const owner =
        ownerFallback || (await UserModel.findOne({ gymId, role: "gym_owner" }).select("_id").lean());
      const queuePayload = {
        gymId: gymId.toString(),
        memberId: member._id.toString(),
        ownerUserId: owner?._id?.toString(),
        to: composePhoneWithCountryCode(member.countryCode, member.phone),
        messageType: "receipt",
        templateName: TEMPLATE_NAMES.PAYMENT_RECEIVED,
        variables: {
          memberName: member.name,
          amount,
          paidDate: paidDate.toISOString(),
        },
        correlationId: payment._id.toString(),
        lineConfig: outboundLineConfig || undefined,
      };
      const queueMessageContent = `Payment receipt: ${member.name} paid ${amount}`;
      try {
        if (!outboundLineConfig) {
          logger.warn("No active WhatsApp sender line configured for this gym.", {
            gymId: gymId.toString(),
            paymentId: payment._id.toString(),
          });
        }
        await waOutboundQueue.add("payment-receipt", queuePayload, {
          jobId: `payment-receipt:${payment._id.toString()}`,
        });
        await incrementDailySentUsage(gymId);
        await persistOutgoingMessage(db, {
          gymId,
          sentBy: receivedByUserId,
          sentByRole: auth?.role === "admin" ? "admin" : "gym_owner",
          channel: "whatsapp",
          direction: "outbound",
          source: "payment_receipt",
          content: queueMessageContent,
          recipientPhone: composePhoneWithCountryCode(member.countryCode, member.phone),
          phoneUsed: outboundLineConfig?.phone,
          phoneNumberIdUsed: outboundLineConfig?.phoneNumberIdEncrypted,
          wabaIdUsed: outboundLineConfig?.wabaIdEncrypted,
          status: "queued",
          meta: {
            paymentId: payment._id.toString(),
            memberId: member._id.toString(),
            correlationId: payment._id.toString(),
            templateName: TEMPLATE_NAMES.PAYMENT_RECEIVED,
            method: String(payload.method || "cash"),
          },
        });
      } catch (error) {
        await releaseWhatsAppQuota(gymId);
        quotaConsumed = false;
        await persistOutgoingMessage(db, {
          gymId,
          sentBy: receivedByUserId,
          sentByRole: auth?.role === "admin" ? "admin" : "gym_owner",
          channel: "whatsapp",
          direction: "outbound",
          source: "payment_receipt",
          content: queueMessageContent,
          recipientPhone: composePhoneWithCountryCode(member.countryCode, member.phone),
          phoneUsed: outboundLineConfig?.phone,
          phoneNumberIdUsed: outboundLineConfig?.phoneNumberIdEncrypted,
          wabaIdUsed: outboundLineConfig?.wabaIdEncrypted,
          status: "failed",
          error: (error as Error).message,
          meta: {
            paymentId: payment._id.toString(),
            memberId: member._id.toString(),
            correlationId: payment._id.toString(),
            templateName: TEMPLATE_NAMES.PAYMENT_RECEIVED,
            method: String(payload.method || "cash"),
          },
        });
        logger.warn("Payment saved but receipt queueing failed", {
          gymId: gymId.toString(),
          memberId: member._id.toString(),
          paymentId: payment._id.toString(),
          error: (error as Error).message,
        });
      }

      await logGymAction(auth, gymId, "Created Payment", "member_payment", payment._id.toString(), {
        memberId: member._id.toString(),
        amount,
      });

      return payment.toObject();
    } catch (error) {
      if (quotaConsumed) {
        await releaseWhatsAppQuota(gymId);
      }
      throw error;
    }
  },

  async pendingPayments(rawQuery: unknown, auth: AuthContext, db: Connection) {


    const gymId = assertGymId(auth);
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["nextDueDate"],
      fallbackSortDesc: [false],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["name", "phone", "plan"],
    });
    const filters: Record<string, unknown> = { gymId, paymentStatus: "pending" };
    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [filters, searchMatch] }
        : filters;

    const [tableData, totalCount] = await Promise.all([
      db.models.Member.find(finalFilter, query.projection || undefined)
        .sort(query.sort)
        .skip(query.skip)
        .limit(query.itemsPerPage)
        .lean(),
      db.models.Member.countDocuments(finalFilter),
    ]);

    return {
      totalCount,
      page: query.page,
      itemsPerPage: query.itemsPerPage,
      sortBy: query.sortBy,
      sortDesc: query.sortDesc,
      tableData: tableData.map(member => ({
        ...member,
        overdueDays: Math.max(
          0,
          Math.floor((Date.now() - new Date(member.nextDueDate).getTime()) / (1000 * 60 * 60 * 24)),
        ),
      })),
      items: tableData.map(member => ({
        ...member,
        overdueDays: Math.max(
          0,
          Math.floor((Date.now() - new Date(member.nextDueDate).getTime()) / (1000 * 60 * 60 * 24)),
        ),
      })),
    };
  },

  async billingSummary(context: unknown) {
    const payload = context as { auth?: AuthContext };
    const gymId = assertGymId(payload.auth);
    const [gym, subscription, payments, usage] = await Promise.all([
      GymModel.findById(gymId).populate("planId").lean(),
      SubscriptionModel.findOne({ gymId }).sort({ createdAt: -1 }).populate("planId").lean(),
      SubscriptionPaymentModel.find({ gymId }).sort({ paidAt: -1 }).limit(20).lean(),
      WhatsAppUsageMonthlyModel.findOne({ gymId, monthKey: monthKeyFromDate(new Date()) }).lean(),
    ]);

    return {
      gym,
      subscription,
      payments,
      whatsappUsage: usage || null,
    };
  },

  async updateSettings(rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const gym = await GymModel.findById(gymId);
    if (!gym) {
      throw new Error("Gym not found");
    }

    const ownerUpdates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      gym.name = String(payload.name).trim();
    }
    if (payload.ownerName !== undefined) {
      const ownerName = String(payload.ownerName).trim();
      gym.ownerName = ownerName;
      ownerUpdates.name = ownerName;
    }
    if (payload.phone !== undefined) {
      const phone = String(payload.phone).trim();
      gym.phone = phone;
      ownerUpdates.phone = phone;
    }
    if (payload.upiId !== undefined) {
      const upiId = String(payload.upiId || "").trim();
      gym.upiId = upiId || undefined;
    }
    if (payload.gymDisplayName !== undefined) {
      const gymDisplayName = String(payload.gymDisplayName || "").trim();
      gym.gymDisplayName = gymDisplayName || undefined;
    }
    if (payload.autoRenewal !== undefined) {
      gym.subscription.autoRenewal = Boolean(payload.autoRenewal);
    }

    await gym.save();

    const ownerId = auth?.userId;
    if (ownerId && Types.ObjectId.isValid(ownerId) && Object.keys(ownerUpdates).length > 0) {
      await UserModel.findByIdAndUpdate(ownerId, { $set: ownerUpdates });
    }

    await logGymAction(auth, gymId, "Updated Gym Settings", "gym", gym._id.toString(), {
      fields: Object.keys(payload),
    });

    return gym.toObject();
  },

  async listSupportTickets(rawQuery: unknown, auth: AuthContext, db: Connection) {
    const gymId = assertGymId(auth);
    const query = normalizeTableQuery(rawQuery, {
      fallbackSortBy: ["lastUpdatedAt"],
      fallbackSortDesc: [true],
      fallbackItemsPerPage: 20,
      fallbackSearchFields: ["subject", "message", "status", "priority"],
    });

    const filters: Record<string, unknown> = { gymId };
    if (query.filters.status) filters.status = String(query.filters.status);
    if (query.filters.priority) filters.priority = String(query.filters.priority);

    const searchMatch = buildTableSearchMatch(query.search);
    const finalFilter =
      Object.keys(searchMatch).length > 0
        ? { $and: [filters, searchMatch] }
        : filters;

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

  async createSupportTicket(rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const payload = (rawPayload || {}) as Record<string, unknown>;

    const ownerId = auth?.userId;
    if (!ownerId || !Types.ObjectId.isValid(ownerId)) {
      throw new Error("Owner context is required");
    }

    const ticket = await SupportTicketModel.create({
      gymId,
      ownerUserId: new Types.ObjectId(ownerId),
      subject: String(payload.subject || "General Support"),
      message: String(payload.message || ""),
      status: "open",
      priority: payload.priority ? String(payload.priority) : "medium",
      replies: [],
      lastUpdatedAt: new Date(),
    });

    await logGymAction(auth, gymId, "Created Support Ticket", "support_ticket", ticket._id.toString());
    return ticket.toObject();
  },
};
