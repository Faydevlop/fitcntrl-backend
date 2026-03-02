import { Schema, Types } from "mongoose";

export interface RefreshTokenDocument {
    userId: Types.ObjectId;
    role: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export const refreshTokenSchema = new Schema<RefreshTokenDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, required: true },
        token: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
