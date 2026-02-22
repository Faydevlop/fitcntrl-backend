import { Schema, model, Types } from "mongoose";

export interface MemberDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  name: string;
  phone: string;
  plan: "monthly" | "quarterly" | "yearly";
  fee: number;
  joinDate: Date;
  nextDueDate: Date;
  status: "active" | "paused" | "expired" | "blacklisted";
  paymentStatus: "paid" | "pending";
  notes?: string;
  lastPaymentDate?: Date;
  lastPaymentMethod?: "cash" | "upi" | "card" | "online";
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<MemberDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    plan: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
    fee: { type: Number, required: true, min: 0 },
    joinDate: { type: Date, required: true },
    nextDueDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "paused", "expired", "blacklisted"], default: "active" },
    paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" },
    notes: { type: String, trim: true },
    lastPaymentDate: { type: Date },
    lastPaymentMethod: { type: String, enum: ["cash", "upi", "card", "online"] }
  },
  { timestamps: true, versionKey: false }
);

memberSchema.index({ gymId: 1, phone: 1 }, { unique: true });
memberSchema.index({ gymId: 1, paymentStatus: 1, nextDueDate: 1 });
memberSchema.index({ gymId: 1, status: 1 });

export const MemberModel = model<MemberDocument>("Member", memberSchema);
