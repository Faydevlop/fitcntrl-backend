import { Types } from "mongoose";
import { parsePagination, monthKeyFromDate } from "../../../../common/utils/query";
import { GymModel } from "../../../admin/model/gym.model";
import { SubscriptionModel } from "../../../admin/model/subscription.model";
import { SubscriptionPaymentModel } from "../../../admin/model/subscription-payment.model";
import { SupportTicketModel } from "../../../admin/model/support-ticket.model";
import { WhatsAppUsageMonthlyModel } from "../../../admin/model/whatsapp-usage-monthly.model";
import { MemberModel } from "../../model/member.model";
import { MemberPaymentModel } from "../../model/member-payment.model";
import { waOutboundQueue } from "../../../../bootstrap/queues";
import { ActivityLogModel } from "../../../admin/model/activity-log.model";
import { UserModel } from "../../../auth/model/user.model";

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

const nextDueByPlan = (startDate: Date, plan: string): Date => {
  const due = new Date(startDate);
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

const getMonthLabel = (date: Date): string => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const logGymAction = async (
  auth: AuthContext,
  gymId: Types.ObjectId,
  action: string,
  entityType: string,
  entityId?: string,
  meta?: Record<string, unknown>
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
    meta
  });
};

const refreshMemberCounts = async (gymId: Types.ObjectId): Promise<void> => {
  const grouped = await MemberModel.aggregate([
    { $match: { gymId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const counts = {
    total: 0,
    active: 0,
    paused: 0,
    expired: 0,
    blacklisted: 0
  };

  grouped.forEach((row) => {
    const key = String(row._id) as keyof typeof counts;
    if (counts[key] !== undefined) {
      counts[key] = row.count;
    }
    counts.total += row.count;
  });

  await GymModel.findByIdAndUpdate(gymId, { $set: { memberCounts: counts } });
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
      subscription
    ] = await Promise.all([
      MemberModel.countDocuments({ gymId }),
      MemberModel.countDocuments({ gymId, status: { $in: ["active", "paused"] } }),
      MemberModel.countDocuments({ gymId, paymentStatus: "pending" }),
      MemberModel.aggregate([{ $match: { gymId, paymentStatus: "pending" } }, { $group: { _id: null, amount: { $sum: "$fee" } } }]),
      MemberPaymentModel.aggregate([{ $match: { gymId } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
      MemberModel.find({ gymId, paymentStatus: "pending" })
        .sort({ nextDueDate: 1 })
        .limit(5)
        .select("name phone fee nextDueDate")
        .lean(),
      WhatsAppUsageMonthlyModel.findOne({ gymId, monthKey }).lean(),
      GymModel.findById(gymId).lean(),
      SubscriptionModel.findOne({ gymId }).sort({ createdAt: -1 }).lean()
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
      subscriptionStatus: subscription?.status || null
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
            month: { $month: "$joinDate" }
          },
          joined: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    return {
      totalCount: rows.length,
      items: rows.map((row) => ({
        month: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        joined: row.joined
      }))
    };
  },

  async listMembers(rawQuery: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const query = (rawQuery || {}) as QueryInput;
    const { page, limit, skip } = parsePagination(query);
    const filters: Record<string, unknown> = { gymId };

    if (query.status) filters.status = String(query.status);
    if (query.paymentStatus) filters.paymentStatus = String(query.paymentStatus);
    if (query.plan) filters.plan = String(query.plan);
    if (query.search) {
      const keyword = String(query.search);
      filters.$or = [{ name: { $regex: keyword, $options: "i" } }, { phone: { $regex: keyword, $options: "i" } }];
    }

    const [items, totalCount] = await Promise.all([
      MemberModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      MemberModel.countDocuments(filters)
    ]);

    return { totalCount, page, limit, items };
  },

  async createMember(rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const joinDate = parseDate(payload.joinDate, new Date());

    const member = await MemberModel.create({
      gymId,
      name: String(payload.name || ""),
      phone: String(payload.phone || ""),
      plan: String(payload.plan || "monthly"),
      fee: Number(payload.fee || 0),
      joinDate,
      nextDueDate: payload.nextDueDate ? parseDate(payload.nextDueDate, nextDueByPlan(joinDate, String(payload.plan || "monthly"))) : nextDueByPlan(joinDate, String(payload.plan || "monthly")),
      status: payload.status ? String(payload.status) : "active",
      paymentStatus: payload.paymentStatus ? String(payload.paymentStatus) : "pending",
      notes: payload.notes ? String(payload.notes) : ""
    });

    await refreshMemberCounts(gymId);
    await logGymAction(auth, gymId, "Created Member", "member", member._id.toString());

    return member.toObject();
  },

  async getMemberById(id: string, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const member = await MemberModel.findOne({ _id: id, gymId }).lean();
    if (!member) {
      throw new Error("Member not found");
    }

    const payments = await MemberPaymentModel.find({ gymId, memberId: member._id }).sort({ paidDate: -1 }).lean();
    return { ...member, payments };
  },

  async updateMember(id: string, rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const payload = (rawPayload || {}) as Record<string, unknown>;
    const member = await MemberModel.findOne({ _id: id, gymId });
    if (!member) {
      throw new Error("Member not found");
    }

    if (payload.name !== undefined) member.name = String(payload.name);
    if (payload.phone !== undefined) member.phone = String(payload.phone);
    if (payload.plan !== undefined) member.plan = String(payload.plan) as typeof member.plan;
    if (payload.fee !== undefined) member.fee = Number(payload.fee);
    if (payload.nextDueDate !== undefined) member.nextDueDate = parseDate(payload.nextDueDate, member.nextDueDate);
    if (payload.status !== undefined) member.status = String(payload.status) as typeof member.status;
    if (payload.paymentStatus !== undefined) member.paymentStatus = String(payload.paymentStatus) as typeof member.paymentStatus;
    if (payload.notes !== undefined) member.notes = String(payload.notes);

    await member.save();
    await refreshMemberCounts(gymId);
    await logGymAction(auth, gymId, "Updated Member", "member", member._id.toString());

    return member.toObject();
  },

  async deleteMember(id: string, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const member = await MemberModel.findOneAndUpdate(
      { _id: id, gymId },
      { $set: { status: "blacklisted", paymentStatus: "pending" } },
      { new: true }
    ).lean();
    if (!member) {
      throw new Error("Member not found");
    }
    await refreshMemberCounts(gymId);
    await logGymAction(auth, gymId, "Blacklisted Member", "member", id);
    return { id, status: member.status };
  },

  async listPayments(rawQuery: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const query = (rawQuery || {}) as QueryInput;
    const { page, limit, skip } = parsePagination(query);
    const filters: Record<string, unknown> = { gymId };

    if (query.memberId && Types.ObjectId.isValid(String(query.memberId))) {
      filters.memberId = new Types.ObjectId(String(query.memberId));
    }
    if (query.method) filters.method = String(query.method);
    if (query.search) {
      const keyword = String(query.search);
      const members = await MemberModel.find({
        gymId,
        $or: [{ name: { $regex: keyword, $options: "i" } }, { phone: { $regex: keyword, $options: "i" } }]
      })
        .select("_id")
        .lean();
      filters.memberId = { $in: members.map((member) => member._id) };
    }

    const [items, totalCount] = await Promise.all([
      MemberPaymentModel.find(filters).sort({ paidDate: -1 }).skip(skip).limit(limit).lean(),
      MemberPaymentModel.countDocuments(filters)
    ]);

    return { totalCount, page, limit, items };
  },

  async createPayment(rawPayload: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const payload = (rawPayload || {}) as Record<string, unknown>;
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
      receivedByUserId
    });

    member.paymentStatus = "paid";
    member.lastPaymentDate = paidDate;
    member.lastPaymentMethod = String(payload.method || "cash") as typeof member.lastPaymentMethod;
    member.nextDueDate = nextDueByPlan(paidDate, member.plan);
    await member.save();

    const owner = ownerFallback || (await UserModel.findOne({ gymId, role: "gym_owner" }).select("_id").lean());
    const queuePayload = {
      gymId: gymId.toString(),
      memberId: member._id.toString(),
      ownerUserId: owner?._id?.toString(),
      to: member.phone,
      messageType: "receipt",
      templateName: "payment_received",
      variables: {
        memberName: member.name,
        amount,
        paidDate: paidDate.toISOString()
      },
      correlationId: payment._id.toString()
    };
    await waOutboundQueue.add("payment-receipt", queuePayload, {
      jobId: `payment-receipt:${payment._id.toString()}`
    });

    await logGymAction(auth, gymId, "Created Payment", "member_payment", payment._id.toString(), {
      memberId: member._id.toString(),
      amount
    });

    return payment.toObject();
  },

  async pendingPayments(rawQuery: unknown, auth: AuthContext) {
    const gymId = assertGymId(auth);
    const query = (rawQuery || {}) as QueryInput;
    const { page, limit, skip } = parsePagination(query);
    const filters: Record<string, unknown> = { gymId, paymentStatus: "pending" };

    if (query.search) {
      const keyword = String(query.search);
      filters.$or = [{ name: { $regex: keyword, $options: "i" } }, { phone: { $regex: keyword, $options: "i" } }];
    }

    const [items, totalCount] = await Promise.all([
      MemberModel.find(filters).sort({ nextDueDate: 1 }).skip(skip).limit(limit).lean(),
      MemberModel.countDocuments(filters)
    ]);

    return {
      totalCount,
      page,
      limit,
      items: items.map((member) => ({
        ...member,
        overdueDays: Math.max(
          0,
          Math.floor((Date.now() - new Date(member.nextDueDate).getTime()) / (1000 * 60 * 60 * 24))
        )
      }))
    };
  },

  async billingSummary(context: unknown) {
    const payload = context as { auth?: AuthContext };
    const gymId = assertGymId(payload.auth);
    const [gym, subscription, payments, usage] = await Promise.all([
      GymModel.findById(gymId).populate("planId").lean(),
      SubscriptionModel.findOne({ gymId }).sort({ createdAt: -1 }).populate("planId").lean(),
      SubscriptionPaymentModel.find({ gymId }).sort({ paidAt: -1 }).limit(20).lean(),
      WhatsAppUsageMonthlyModel.findOne({ gymId, monthKey: monthKeyFromDate(new Date()) }).lean()
    ]);

    return {
      gym,
      subscription,
      payments,
      whatsappUsage: usage || null
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
      lastUpdatedAt: new Date()
    });

    await logGymAction(auth, gymId, "Created Support Ticket", "support_ticket", ticket._id.toString());
    return ticket.toObject();
  }
};
