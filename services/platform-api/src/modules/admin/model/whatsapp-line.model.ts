import { Schema, model, Types } from "mongoose";

export interface WhatsAppLineDocument {
  _id: Types.ObjectId;
  phone: string;
  phoneNumberId: string;
  wabaId: string;
  tokenEncrypted: string;
  setForBasic: boolean;
  assignedGymId?: Types.ObjectId | null;
  qualityRating?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappLineSchema = new Schema<WhatsAppLineDocument>(
  {
    phone: { type: String, required: true, trim: true },
    phoneNumberId: { type: String, required: true, unique: true, trim: true },
    wabaId: { type: String, required: true, trim: true },
    tokenEncrypted: { type: String, required: true },
    setForBasic: { type: Boolean, default: false },
    assignedGymId: { type: Schema.Types.ObjectId, ref: "Gym", default: null, index: true },
    qualityRating: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

whatsappLineSchema.index({ setForBasic: 1 }, { unique: true, partialFilterExpression: { setForBasic: true } });

export const WhatsAppLineModel = model<WhatsAppLineDocument>("WhatsAppLine", whatsappLineSchema);
