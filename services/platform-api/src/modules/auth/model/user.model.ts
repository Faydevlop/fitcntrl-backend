import { Schema, model, Types } from "mongoose";
import { UserRole } from "../../../common/constants/enums";

export interface UserDocument {
  _id: Types.ObjectId;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  gymId?: Types.ObjectId;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "gym_owner"], required: true },
    gymId: { type: Schema.Types.ObjectId, ref: "Gym" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ role: 1, gymId: 1 });

export const UserModel = model<UserDocument>("User", userSchema);
