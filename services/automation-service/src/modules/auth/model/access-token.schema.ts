import { Schema, Types } from "mongoose";

export interface AccessTokenDocument {
    userId: Types.ObjectId;
    role: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export const accessTokenSchema = new Schema<AccessTokenDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, required: true },
        token: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

accessTokenSchema.index({ userId: 1 });
accessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
