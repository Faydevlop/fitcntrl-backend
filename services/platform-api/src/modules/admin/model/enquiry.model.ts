import { Schema, model, Types } from "mongoose";

export interface EnquiryDocument {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  gymName: string;
  city: string;
  membersCount: string;
  message: string;
  status: "new" | "contacted" | "closed";
  assignedTo?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<EnquiryDocument>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    gymName: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    membersCount: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

enquirySchema.index({ status: 1, createdAt: -1 });

export const EnquiryModel = model<EnquiryDocument>("Enquiry", enquirySchema);
