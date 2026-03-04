import { userSchema } from "../model/user.model";
import { accessTokenSchema } from "../model/access-token.schema";
import { refreshTokenSchema } from "../model/refresh-token.schema";
import { activityLogSchema } from "../../admin/model/activity-log.model";
import { otpSchema } from "./otp.model";
import { Connection } from "mongoose";
import { GymModel } from "../../admin/model/gym.model";
import { PlanModel } from "../../admin/model/plan.model";
import { SubscriptionModel } from "../../admin/model/subscription.model";
import { SubscriptionPaymentModel } from "../../admin/model/subscription-payment.model";
import { SupportTicketModel } from "../../admin/model/support-ticket.model";
import { WhatsAppLineModel } from "../../admin/model/whatsapp-line.model";
import { WhatsAppUsageMonthlyModel } from "../../admin/model/whatsapp-usage-monthly.model";
import { EnquiryModel } from "../../admin/model/enquiry.model";
import { AnnouncementModel } from "../../admin/model/announcement.model";
import { MemberModel } from "../../gym/model/member.model";
import { MemberPaymentModel } from "../../gym/model/member-payment.model";
import { passwordResetTokenSchema } from "./password-reset-token.model";
import { BackupTimelineModel } from "../../admin/model/backup-timeline.model";
import { MessageModel } from "../../admin/model/message.model";

export const SCHEMAS = {
  USER: "User",
  ACCESS_TOKEN: "AccessToken",
  REFRESH_TOKEN: "RefreshToken",
  ACTIVITY_LOG: "ActivityLog",
  OTP: "Otp",
  PASSWORD_RESET_TOKEN: "PasswordResetToken",
  GYM: "Gym",
  PLAN: "Plan",
  SUBSCRIPTION: "Subscription",
  SUBSCRIPTION_PAYMENT: "SubscriptionPayment",
  SUPPORT_TICKET: "SupportTicket",
  WHATSAPP_LINE: "WhatsAppLine",
  WHATSAPP_USAGE_MONTHLY: "WhatsAppUsageMonthly",
  ENQUIRY: "Enquiry",
  ANNOUNCEMENT: "Announcement",
  MEMBER: "Member",
  MEMBER_PAYMENT: "MemberPayment",
  BACKUP_TIMELINE: "BackupTimeline",
  MESSAGE: "Message",
};

export const registerAuthModels = (db: Connection) => {
  if (!db.models[SCHEMAS.USER]) db.model(SCHEMAS.USER, userSchema);
  if (!db.models[SCHEMAS.ACCESS_TOKEN]) db.model(SCHEMAS.ACCESS_TOKEN, accessTokenSchema);
  if (!db.models[SCHEMAS.REFRESH_TOKEN]) db.model(SCHEMAS.REFRESH_TOKEN, refreshTokenSchema);
  if (!db.models[SCHEMAS.ACTIVITY_LOG]) db.model(SCHEMAS.ACTIVITY_LOG, activityLogSchema);
  if (!db.models[SCHEMAS.OTP]) db.model(SCHEMAS.OTP, otpSchema);
  if (!db.models[SCHEMAS.PASSWORD_RESET_TOKEN]) {
    db.model(SCHEMAS.PASSWORD_RESET_TOKEN, passwordResetTokenSchema);
  }
  if (!db.models[SCHEMAS.GYM]) db.model(SCHEMAS.GYM, GymModel.schema);
  if (!db.models[SCHEMAS.PLAN]) db.model(SCHEMAS.PLAN, PlanModel.schema);
  if (!db.models[SCHEMAS.SUBSCRIPTION]) db.model(SCHEMAS.SUBSCRIPTION, SubscriptionModel.schema);
  if (!db.models[SCHEMAS.SUBSCRIPTION_PAYMENT]) {
    db.model(SCHEMAS.SUBSCRIPTION_PAYMENT, SubscriptionPaymentModel.schema);
  }
  if (!db.models[SCHEMAS.SUPPORT_TICKET]) db.model(SCHEMAS.SUPPORT_TICKET, SupportTicketModel.schema);
  if (!db.models[SCHEMAS.WHATSAPP_LINE]) db.model(SCHEMAS.WHATSAPP_LINE, WhatsAppLineModel.schema);
  if (!db.models[SCHEMAS.WHATSAPP_USAGE_MONTHLY]) {
    db.model(SCHEMAS.WHATSAPP_USAGE_MONTHLY, WhatsAppUsageMonthlyModel.schema);
  }
  if (!db.models[SCHEMAS.ENQUIRY]) db.model(SCHEMAS.ENQUIRY, EnquiryModel.schema);
  if (!db.models[SCHEMAS.ANNOUNCEMENT]) db.model(SCHEMAS.ANNOUNCEMENT, AnnouncementModel.schema);
  if (!db.models[SCHEMAS.MEMBER]) db.model(SCHEMAS.MEMBER, MemberModel.schema);
  if (!db.models[SCHEMAS.MEMBER_PAYMENT]) db.model(SCHEMAS.MEMBER_PAYMENT, MemberPaymentModel.schema);
  if (!db.models[SCHEMAS.BACKUP_TIMELINE]) db.model(SCHEMAS.BACKUP_TIMELINE, BackupTimelineModel.schema);
  if (!db.models[SCHEMAS.MESSAGE]) db.model(SCHEMAS.MESSAGE, MessageModel.schema);
};

