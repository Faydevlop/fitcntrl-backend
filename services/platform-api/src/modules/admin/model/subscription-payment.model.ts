import { Schema, model, Types } from "mongoose";

export interface SubscriptionPaymentDocument {
  _id: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  gymId: Types.ObjectId;
  amount: number;
  status: "success" | "failed" | "pending";
  paidAt: Date;
  providerPaymentId?: string;
  invoiceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPaymentSchema = new Schema<SubscriptionPaymentDocument>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["success", "failed", "pending"], required: true },
    paidAt: { type: Date, required: true },
    providerPaymentId: { type: String, trim: true },
    invoiceUrl: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false },
);

subscriptionPaymentSchema.index({ subscriptionId: 1, paidAt: -1 });
subscriptionPaymentSchema.index({ gymId: 1, paidAt: -1 });

export const SubscriptionPaymentModel = model<SubscriptionPaymentDocument>(
  "SubscriptionPayment",
  subscriptionPaymentSchema,
);
