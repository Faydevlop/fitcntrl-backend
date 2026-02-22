import { Schema, model, Types } from "mongoose";

export interface ActivityLogDocument {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorRole: "admin" | "gym_owner";
  gymId?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<ActivityLogDocument>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, enum: ["admin", "gym_owner"], required: true },
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", index: true },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

activityLogSchema.index({ gymId: 1, createdAt: -1 });

export const ActivityLogModel = model<ActivityLogDocument>("ActivityLog", activityLogSchema);
