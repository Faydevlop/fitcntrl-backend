import { Model, model, models, Schema, Types } from "mongoose";

export interface UserRefDocument {
  _id: Types.ObjectId;
  email: string;
  phone?: string;
  role: "admin" | "gym_owner";
  gymId?: Types.ObjectId;
  isActive: boolean;
}

export interface MemberRefDocument {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  name: string;
  phone: string;
  fee: number;
  paymentStatus: "paid" | "pending";
  nextDueDate: Date;
}

export interface GymRefDocument {
  _id: Types.ObjectId;
  name: string;
  ownerName: string;
  phone: string;
  status: string;
  waMode: "shared" | "dedicated";
  planId?: Types.ObjectId;
}

export interface PlanRefDocument {
  _id: Types.ObjectId;
  isBasic?: boolean;
}

export interface WhatsAppLineRefDocument {
  _id: Types.ObjectId;
  phone: string;
  phoneNumberId: string;
  wabaId: string;
  tokenEncrypted: string;
  setForBasic: boolean;
  assignedGymId?: Types.ObjectId | null;
  isActive: boolean;
}

const userRefSchema = new Schema<UserRefDocument>(
  {
    email: String,
    phone: String,
    role: String,
    gymId: Schema.Types.ObjectId,
    isActive: Boolean,
  },
  { versionKey: false },
);

const memberRefSchema = new Schema<MemberRefDocument>(
  {
    gymId: Schema.Types.ObjectId,
    name: String,
    phone: String,
    fee: Number,
    paymentStatus: String,
    nextDueDate: Date,
  },
  { versionKey: false },
);

const gymRefSchema = new Schema<GymRefDocument>(
  {
    name: String,
    ownerName: String,
    phone: String,
    status: String,
    waMode: String,
    planId: Schema.Types.ObjectId,
  },
  { versionKey: false },
);

const planRefSchema = new Schema<PlanRefDocument>(
  {
    isBasic: Boolean,
  },
  { versionKey: false },
);

const whatsappLineRefSchema = new Schema<WhatsAppLineRefDocument>(
  {
    phone: String,
    phoneNumberId: String,
    wabaId: String,
    tokenEncrypted: String,
    setForBasic: Boolean,
    assignedGymId: Schema.Types.ObjectId,
    isActive: Boolean,
  },
  { versionKey: false },
);

export const UserRefModel: Model<UserRefDocument> =
  (models.UserRef as Model<UserRefDocument>) || model<UserRefDocument>("UserRef", userRefSchema, "users");
export const MemberRefModel: Model<MemberRefDocument> =
  (models.MemberRef as Model<MemberRefDocument>) ||
  model<MemberRefDocument>("MemberRef", memberRefSchema, "members");
export const GymRefModel: Model<GymRefDocument> =
  (models.GymRef as Model<GymRefDocument>) || model<GymRefDocument>("GymRef", gymRefSchema, "gyms");
export const PlanRefModel: Model<PlanRefDocument> =
  (models.PlanRef as Model<PlanRefDocument>) || model<PlanRefDocument>("PlanRef", planRefSchema, "plans");
export const WhatsAppLineRefModel: Model<WhatsAppLineRefDocument> =
  (models.WhatsAppLineRef as Model<WhatsAppLineRefDocument>) ||
  model<WhatsAppLineRefDocument>("WhatsAppLineRef", whatsappLineRefSchema, "whatsapplines");
