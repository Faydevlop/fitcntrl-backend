import { Schema, model, Types } from "mongoose";

export interface SubscriptionDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  planId: Types.ObjectId;
  status: "active" | "past_due" | "cancelled" | "trialing";
  paymentStatus: "paid" | "pending" | "overdue";
  startDate: Date;
  expiryDate: Date;
  nextBillingDate?: Date;
  lastPaymentDate?: Date;
  providerSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    status: {
      type: String,
      enum: ["active", "past_due", "cancelled", "trialing"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      required: true
    },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    nextBillingDate: { type: Date },
    lastPaymentDate: { type: Date },
    providerSubscriptionId: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false }
);

subscriptionSchema.index({ status: 1, paymentStatus: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

export const SubscriptionModel = model<SubscriptionDocument>("Subscription", subscriptionSchema);
