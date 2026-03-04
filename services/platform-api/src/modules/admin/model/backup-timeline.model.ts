import { Schema, model, Types } from "mongoose";

type BackupStatus = "running" | "passed" | "failed";

interface BackupDbSummary {
  databaseLabel: "primary" | "demo";
  collectionsCount: number;
  documentsCount: number;
  collectionFiles: string[];
}

export interface BackupTimelineDocument {
  _id: Types.ObjectId;
  backupDate: string;
  scheduledHour: number;
  timezone: string;
  status: BackupStatus;
  backupFolderPath: string;
  startedAt: Date;
  completedAt?: Date;
  backupDoneAt?: Date;
  errorMessage?: string;
  summaries: BackupDbSummary[];
  createdAt: Date;
  updatedAt: Date;
}

const backupDbSummarySchema = new Schema<BackupDbSummary>(
  {
    databaseLabel: { type: String, enum: ["primary", "demo"], required: true },
    collectionsCount: { type: Number, required: true, min: 0, default: 0 },
    documentsCount: { type: Number, required: true, min: 0, default: 0 },
    collectionFiles: { type: [String], default: [] },
  },
  { _id: false },
);

const backupTimelineSchema = new Schema<BackupTimelineDocument>(
  {
    backupDate: { type: String, required: true, index: true },
    scheduledHour: { type: Number, min: 0, max: 23, required: true },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    status: { type: String, enum: ["running", "passed", "failed"], required: true, default: "running" },
    backupFolderPath: { type: String, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    backupDoneAt: { type: Date },
    errorMessage: { type: String },
    summaries: { type: [backupDbSummarySchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: "backuptimes" },
);

backupTimelineSchema.index({ backupDate: 1, scheduledHour: 1 }, { unique: true });
backupTimelineSchema.index({ backupDate: 1, status: 1 });

export const BackupTimelineModel = model<BackupTimelineDocument>("BackupTimeline", backupTimelineSchema);
