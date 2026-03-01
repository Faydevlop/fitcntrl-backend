import { Schema, model, Types } from "mongoose";

export interface WhatsAppMessageLogDocument {
  _id: Types.ObjectId;
  gymId?: Types.ObjectId;
  memberId?: Types.ObjectId;
  ownerUserId?: Types.ObjectId;
  direction: "inbound" | "outbound";
  type: string;
  templateName?: string;
  status: "queued" | "sent" | "delivered" | "failed";
  providerMessageId?: string;
  payload: Record<string, unknown>;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappMessageLogSchema = new Schema<WhatsAppMessageLogDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", index: true },
    memberId: { type: Schema.Types.ObjectId, ref: "Member" },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, required: true, trim: true },
    templateName: { type: String, trim: true },
    status: { type: String, enum: ["queued", "sent", "delivered", "failed"], required: true },
    providerMessageId: { type: String, trim: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    error: { type: String, trim: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

whatsappMessageLogSchema.index({ gymId: 1, createdAt: -1 });

export const WhatsAppMessageLogModel = model<WhatsAppMessageLogDocument>(
  "WhatsAppMessageLog",
  whatsappMessageLogSchema,
);
