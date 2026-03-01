import { Schema, model, Types } from "mongoose";

interface SupportReply {
  sender: "owner" | "admin";
  senderName: string;
  message: string;
  timestamp: Date;
}

export interface SupportTicketDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  replies: SupportReply[];
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const supportReplySchema = new Schema<SupportReply>(
  {
    sender: { type: String, enum: ["owner", "admin"], required: true },
    senderName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
);

const supportTicketSchema = new Schema<SupportTicketDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    replies: { type: [supportReplySchema], default: [] },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

supportTicketSchema.index({ gymId: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1, lastUpdatedAt: -1 });

export const SupportTicketModel = model<SupportTicketDocument>("SupportTicket", supportTicketSchema);
