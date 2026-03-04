import { Schema, model, Types } from "mongoose";
import { PlatformType, PLATFORM_TYPE_VALUES, UserRole } from "../../../common/constants/enums";

export interface UserDocument {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  countryCode?: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  platformType?: PlatformType;
  onboardingComplete: boolean;
  gymId?: Types.ObjectId;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    countryCode: { type: String, trim: true, default: "91" },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "gym_owner"], required: true },
    platformType: { type: String, enum: [...PLATFORM_TYPE_VALUES], required: false },
    onboardingComplete: { type: Boolean, default: false },
    gymId: { type: Schema.Types.ObjectId, ref: "Gym" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ role: 1, gymId: 1 });

export const UserModel = model<UserDocument>("User", userSchema);
