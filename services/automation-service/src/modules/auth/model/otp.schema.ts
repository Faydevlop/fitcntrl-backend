import { Schema, Types } from "mongoose";

export interface OtpDocument {
    _id: Types.ObjectId;
    email: string;
    otp: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const otpSchema = new Schema<OtpDocument>(
    {
        email: { type: String, required: true, lowercase: true, trim: true },
        otp: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true, versionKey: false },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1 }, { unique: true });
