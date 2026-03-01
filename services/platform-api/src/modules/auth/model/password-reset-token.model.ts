import { Schema, model, Types } from "mongoose";

export interface PasswordResetTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channel: "email" | "phone" | "whatsapp";
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: { type: String, enum: ["email", "phone", "whatsapp"], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = model<PasswordResetTokenDocument>(
  "PasswordResetToken",
  passwordResetTokenSchema,
);
