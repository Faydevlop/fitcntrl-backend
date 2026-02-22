import { Schema, model, Types } from "mongoose";

interface GymSubscription {
  startDate: Date;
  expiryDate: Date;
  gracePeriodDays?: number;
  autoRenewal: boolean;
}

interface GymMemberCounts {
  total: number;
  active: number;
  paused: number;
  expired: number;
  blacklisted: number;
}

export interface GymDocument {
  _id: Types.ObjectId;
  name: string;
  ownerName: string;
  ownerUserId: Types.ObjectId;
  phone: string;
  planId: Types.ObjectId;
  status: "active" | "grace_period" | "frozen" | "suspended";
  waMode: "shared" | "dedicated";
  upiId?: string;
  gymDisplayName?: string;
  subscription: GymSubscription;
  memberCounts: GymMemberCounts;
  createdAt: Date;
  updatedAt: Date;
}

const gymSchema = new Schema<GymDocument>(
  {
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String, required: true, trim: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    status: {
      type: String,
      enum: ["active", "grace_period", "frozen", "suspended"],
      required: true,
      default: "active"
    },
    waMode: {
      type: String,
      enum: ["shared", "dedicated"],
      default: "shared",
      required: true
    },
    upiId: { type: String, trim: true },
    gymDisplayName: { type: String, trim: true },
    subscription: {
      startDate: { type: Date, required: true },
      expiryDate: { type: Date, required: true },
      gracePeriodDays: { type: Number, min: 0 },
      autoRenewal: { type: Boolean, default: true }
    },
    memberCounts: {
      total: { type: Number, default: 0, min: 0 },
      active: { type: Number, default: 0, min: 0 },
      paused: { type: Number, default: 0, min: 0 },
      expired: { type: Number, default: 0, min: 0 },
      blacklisted: { type: Number, default: 0, min: 0 }
    }
  },
  { timestamps: true, versionKey: false }
);

gymSchema.index({ status: 1 });
gymSchema.index({ planId: 1 });
gymSchema.index({ ownerUserId: 1 });

export const GymModel = model<GymDocument>("Gym", gymSchema);
