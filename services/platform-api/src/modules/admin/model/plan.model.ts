import { Schema, model, Types } from "mongoose";

export interface PlanDocument {
  _id: Types.ObjectId;
  name: string;
  billing: "monthly" | "yearly";
  price: number;
  maxMembers: number;
  whatsappLimit: number;
  features: string[];
  active: boolean;
  providerPlanId?: string;
  trialDays?: number;
  gracePeriodDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    name: { type: String, required: true, trim: true },
    billing: { type: String, enum: ["monthly", "yearly"], required: true },
    price: { type: Number, required: true, min: 0 },
    maxMembers: { type: Number, required: true, min: 0 },
    whatsappLimit: { type: Number, required: true, min: 0 },
    features: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    providerPlanId: { type: String },
    trialDays: { type: Number, min: 0 },
    gracePeriodDays: { type: Number, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

planSchema.index({ name: 1, billing: 1 }, { unique: true });
planSchema.index({ active: 1 });

export const PlanModel = model<PlanDocument>("Plan", planSchema);
