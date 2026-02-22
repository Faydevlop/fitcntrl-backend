import { Schema, model, Types } from "mongoose";

export interface MemberPaymentDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  memberId: Types.ObjectId;
  amount: number;
  paidDate: Date;
  monthLabel: string;
  method: "cash" | "upi" | "card" | "online";
  isPartial?: boolean;
  notes?: string;
  receivedByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const memberPaymentSchema = new Schema<MemberPaymentDocument>(
  {
    gymId: { type: Schema.Types.ObjectId, ref: "Gym", required: true, index: true },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paidDate: { type: Date, required: true },
    monthLabel: { type: String, required: true, trim: true },
    method: { type: String, enum: ["cash", "upi", "card", "online"], required: true },
    isPartial: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    receivedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true, versionKey: false }
);

memberPaymentSchema.index({ gymId: 1, paidDate: -1 });
memberPaymentSchema.index({ memberId: 1, paidDate: -1 });

export const MemberPaymentModel = model<MemberPaymentDocument>("MemberPayment", memberPaymentSchema);
