import { Schema, model, Types } from "mongoose";

export interface AnnouncementDocument {
  _id: Types.ObjectId;
  message: string;
  targetGymIds: Types.ObjectId[] | "all";
  sentBy: Types.ObjectId;
  sentAt: Date;
  channel: "in_app" | "whatsapp";
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<AnnouncementDocument>(
  {
    message: { type: String, required: true, trim: true },
    targetGymIds: { type: Schema.Types.Mixed, required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: { type: Date, required: true },
    channel: { type: String, enum: ["in_app", "whatsapp"], required: true, default: "in_app" },
  },
  { timestamps: true, versionKey: false },
);

announcementSchema.index({ sentAt: -1 });

export const AnnouncementModel = model<AnnouncementDocument>("Announcement", announcementSchema);
