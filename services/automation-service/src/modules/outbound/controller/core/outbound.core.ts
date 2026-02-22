import { Types } from "mongoose";
import { waOutboundQueue, waReminderQueue, waReportQueue } from "../../../../bootstrap/queues";
import { WhatsAppMessageLogModel } from "../../model/whatsapp-message-log.model";
import { GymRefModel, MemberRefModel, UserRefModel } from "../../../webhook/model/platform-ref.model";

type ReminderPayload = {
  gymId?: string;
  memberId?: string;
  reason?: string;
  dueDate?: string;
  amount?: number;
};

type ReportPayload = {
  gymId?: string;
  ownerUserId?: string;
  reportType?: "daily" | "weekly" | "manual" | string;
  dateRange?: { from?: string; to?: string };
};

const normalizePhone = (value?: string): string => (value || "").replace(/[^\d+]/g, "");

export const outboundCore = {
  async sendReminder(rawPayload: unknown) {
    const payload = (rawPayload || {}) as ReminderPayload;
    if (!payload.gymId || !payload.memberId) {
      throw new Error("gymId and memberId are required");
    }
    if (!Types.ObjectId.isValid(payload.gymId) || !Types.ObjectId.isValid(payload.memberId)) {
      throw new Error("gymId and memberId must be valid ObjectIds");
    }

    const gymId = new Types.ObjectId(payload.gymId);
    const memberId = new Types.ObjectId(payload.memberId);
    const member = await MemberRefModel.findOne({ _id: memberId, gymId }).lean();
    if (!member) {
      throw new Error("Member not found for given gym");
    }

    const queueMessage = {
      gymId: gymId.toString(),
      memberId: memberId.toString(),
      to: normalizePhone(member.phone),
      messageType: "template",
      templateName: "payment_due_reminder",
      variables: {
        memberName: member.name,
        amount: payload.amount || member.fee,
        dueDate: payload.dueDate || member.nextDueDate,
        reason: payload.reason || "payment_due"
      }
    };

    const messageLog = await WhatsAppMessageLogModel.create({
      gymId,
      memberId,
      direction: "outbound",
      type: "payment_reminder",
      templateName: "payment_due_reminder",
      status: "queued",
      payload: queueMessage
    });

    const reminderJobPayload = { ...queueMessage, messageLogId: messageLog._id.toString() };
    const reminderJob = await waReminderQueue.add("member-reminder", reminderJobPayload, {
      jobId: `wa-reminder:${messageLog._id.toString()}`
    });
    const outboundJob = await waOutboundQueue.add("send-message", reminderJobPayload, {
      jobId: `wa-outbound:${messageLog._id.toString()}`
    });

    return {
      reminderJobId: reminderJob.id,
      outboundJobId: outboundJob.id,
      messageLogId: messageLog._id.toString()
    };
  },

  async sendReport(rawPayload: unknown) {
    const payload = (rawPayload || {}) as ReportPayload;
    if (!payload.gymId || !Types.ObjectId.isValid(payload.gymId)) {
      throw new Error("gymId is required and must be valid");
    }

    const gymId = new Types.ObjectId(payload.gymId);
    const [gym, owner, pendingStats] = await Promise.all([
      GymRefModel.findById(gymId).lean(),
      payload.ownerUserId && Types.ObjectId.isValid(payload.ownerUserId)
        ? UserRefModel.findOne({ _id: new Types.ObjectId(payload.ownerUserId), gymId, role: "gym_owner" }).lean()
        : UserRefModel.findOne({ gymId, role: "gym_owner", isActive: true }).lean(),
      MemberRefModel.aggregate([
        { $match: { gymId, paymentStatus: "pending" } },
        { $group: { _id: null, pendingCount: { $sum: 1 }, pendingAmount: { $sum: "$fee" } } }
      ])
    ]);

    if (!gym) {
      throw new Error("Gym not found");
    }
    if (!owner?.phone) {
      throw new Error("Owner phone is not configured for this gym");
    }

    const reportSummary = {
      gymName: gym.name,
      reportType: payload.reportType || "manual",
      pendingCount: pendingStats[0]?.pendingCount || 0,
      pendingAmount: pendingStats[0]?.pendingAmount || 0,
      generatedAt: new Date().toISOString(),
      dateRange: payload.dateRange || null
    };

    const queueMessage = {
      gymId: gymId.toString(),
      ownerUserId: owner._id.toString(),
      to: normalizePhone(owner.phone),
      messageType: "text",
      templateName: "owner_pending_report",
      variables: reportSummary
    };

    const messageLog = await WhatsAppMessageLogModel.create({
      gymId,
      ownerUserId: owner._id,
      direction: "outbound",
      type: "owner_report",
      templateName: "owner_pending_report",
      status: "queued",
      payload: queueMessage
    });

    const reportPayload = { ...queueMessage, messageLogId: messageLog._id.toString() };
    const reportJob = await waReportQueue.add("owner-report", reportPayload, {
      jobId: `wa-report:${messageLog._id.toString()}`
    });
    const outboundJob = await waOutboundQueue.add("send-message", reportPayload, {
      jobId: `wa-outbound:${messageLog._id.toString()}`
    });

    return {
      reportJobId: reportJob.id,
      outboundJobId: outboundJob.id,
      messageLogId: messageLog._id.toString(),
      report: reportSummary
    };
  }
};
