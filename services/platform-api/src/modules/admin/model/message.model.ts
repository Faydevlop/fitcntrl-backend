import { Schema, model, Types } from "mongoose";

export interface MessageDocument {
  _id: Types.ObjectId;
  gymId?: Types.ObjectId;
  sentBy?: Types.ObjectId;
  sentByRole?: "admin" | "gym_owner" | "system";
  channel: "whatsapp" | "in_app" | "email" | "sms";
  direction: "outbound";
  source: string;
  content: string;
  recipientPhone?: string;
  phoneUsed?: string;
  phoneNumberIdUsed?: string;
  wabaIdUsed?: string;
  status: "queued" | "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  sentAt?: Date;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", index: true },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sentByRole: { type: String, enum: ["admin", "gym_owner", "system"], trim: true },
    channel: { type: String, enum: ["whatsapp", "in_app", "email", "sms"], required: true },
    direction: { type: String, enum: ["outbound"], default: "outbound", required: true },
    source: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    recipientPhone: { type: String, trim: true },
    phoneUsed: { type: String, trim: true },
    phoneNumberIdUsed: { type: String, trim: true },
    wabaIdUsed: { type: String, trim: true },
    status: { type: String, enum: ["queued", "sent", "failed"], required: true },
    providerMessageId: { type: String, trim: true, index: true },
    error: { type: String, trim: true },
    sentAt: { type: Date },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false },
);

messageSchema.index({ gymId: 1, createdAt: -1 });
messageSchema.index({ sentBy: 1, createdAt: -1 });
messageSchema.index({ source: 1, status: 1, createdAt: -1 });

export const MessageModel = model<MessageDocument>("Message", messageSchema);
