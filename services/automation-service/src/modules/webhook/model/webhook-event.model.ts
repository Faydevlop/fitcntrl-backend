import { Schema, model, Types } from "mongoose";

export interface WebhookEventDocument {
  _id: Types.ObjectId;
  provider: "meta";
  eventType: string;
  eventId: string;
  signatureValid: boolean;
  payload: Record<string, unknown>;
  status: "received" | "processed" | "failed";
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<WebhookEventDocument>(
  {
    provider: { type: String, enum: ["meta"], required: true },
    eventType: { type: String, required: true, trim: true },
    eventId: { type: String, required: true, trim: true },
    signatureValid: { type: Boolean, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["received", "processed", "failed"], default: "received", index: true },
    processedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, createdAt: -1 });

export const WebhookEventModel = model<WebhookEventDocument>("WebhookEvent", webhookEventSchema);
