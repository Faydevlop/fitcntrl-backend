import { Schema, model, Types } from "mongoose";

interface DailyUsage {
  date: string;
  sent: number;
  failed: number;
  conversations: number;
}

export interface WhatsAppUsageMonthlyDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  monthKey: string;
  planLimit: number;
  messagesUsed: number;
  messagesFailed: number;
  conversationsCount: number;
  deliveryRate: number;
  daily: DailyUsage[];
  createdAt: Date;
  updatedAt: Date;
}

const dailyUsageSchema = new Schema<DailyUsage>(
  {
    date: { type: String, required: true },
    sent: { type: Number, required: true, min: 0 },
    failed: { type: Number, required: true, min: 0 },
    conversations: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const whatsappUsageMonthlySchema = new Schema<WhatsAppUsageMonthlyDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    monthKey: { type: String, required: true },
    planLimit: { type: Number, required: true, min: 0 },
    messagesUsed: { type: Number, required: true, min: 0, default: 0 },
    messagesFailed: { type: Number, required: true, min: 0, default: 0 },
    conversationsCount: { type: Number, required: true, min: 0, default: 0 },
    deliveryRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
    daily: { type: [dailyUsageSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

whatsappUsageMonthlySchema.index({ gymId: 1, monthKey: 1 }, { unique: true });

export const WhatsAppUsageMonthlyModel = model<WhatsAppUsageMonthlyDocument>(
  "WhatsAppUsageMonthly",
  whatsappUsageMonthlySchema,
);
