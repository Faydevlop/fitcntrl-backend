import { promises as fs } from "fs";
import path from "path";
import mongoose, { Connection } from "mongoose";
import { env } from "../config/env";
import { logger } from "../common/logger/app-logger";
import { BackupTimelineModel } from "../modules/admin/model/backup-timeline.model";

const RETRY_HOURS = new Set(env.backupTimes);
let schedulerTimer: NodeJS.Timeout | null = null;
let runInProgress = false;

type ZonedClock = {
  dateKey: string;
  hour: number;
};

const sanitizeCollectionName = (name: string): string => {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
};

const getZonedClock = (now: Date, timeZone: string): ZonedClock => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  const dateKey = `${map.year || "1970"}-${map.month || "01"}-${map.day || "01"}`;
  const hour = Number(map.hour || "0");
  return { dateKey, hour };
};

const backupConnectionCollections = async (
  connection: Connection,
  destinationDir: string,
  databaseLabel: "primary" | "demo",
) => {
  if (!connection.db) {
    throw new Error(`Database connection is not ready for ${databaseLabel}`);
  }

  await fs.mkdir(destinationDir, { recursive: true });
  const collections = await connection.db.listCollections().toArray();

  let documentsCount = 0;
  const collectionFiles: string[] = [];

  for (const collectionInfo of collections) {
    const collectionName = String(collectionInfo.name || "").trim();
    if (!collectionName) {
      continue;
    }

    const documents = await connection.db.collection(collectionName).find({}).toArray();
    documentsCount += documents.length;

    const fileName = `${sanitizeCollectionName(collectionName)}.json`;
    const filePath = path.join(destinationDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(documents, null, 2), "utf8");
    collectionFiles.push(fileName);
  }

  return {
    databaseLabel,
    collectionsCount: collections.length,
    documentsCount,
    collectionFiles,
  };
};

const runBackupAttempt = async (backupDate: string, scheduledHour: number): Promise<void> => {
  const backupFolderPath = path.resolve(process.cwd(), env.backupRootDir, backupDate);
  const startedAt = new Date();
  const run = await BackupTimelineModel.create({
    backupDate,
    scheduledHour,
    timezone: env.backupTimeZone,
    status: "running",
    backupFolderPath,
    startedAt,
    summaries: [],
  });

  let demoConnection: Connection | null = null;

  try {
    await fs.mkdir(backupFolderPath, { recursive: true });

    const summaries: Array<{
      databaseLabel: "primary" | "demo";
      collectionsCount: number;
      documentsCount: number;
      collectionFiles: string[];
    }> = [];

    const primaryDir = path.join(backupFolderPath, "primary");
    const primarySummary = await backupConnectionCollections(mongoose.connection, primaryDir, "primary");
    summaries.push(primarySummary);

    if (env.mongoDemoUri.trim() && env.mongoDemoUri !== env.mongoUri) {
      demoConnection = await mongoose.createConnection(env.mongoDemoUri).asPromise();
      const demoDir = path.join(backupFolderPath, "demo");
      const demoSummary = await backupConnectionCollections(demoConnection, demoDir, "demo");
      summaries.push(demoSummary);
    }

    const completedAt = new Date();
    await BackupTimelineModel.findByIdAndUpdate(run._id, {
      $set: {
        status: "passed",
        completedAt,
        backupDoneAt: completedAt,
        summaries,
      },
    });

    logger.info("Database backup completed", {
      backupDate,
      scheduledHour,
      backupFolderPath,
      summaries: summaries.map(item => ({
        databaseLabel: item.databaseLabel,
        collectionsCount: item.collectionsCount,
        documentsCount: item.documentsCount,
      })),
    });
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : "Unknown backup error";
    await BackupTimelineModel.findByIdAndUpdate(run._id, {
      $set: {
        status: "failed",
        completedAt,
        errorMessage: message,
      },
    });
    logger.error("Database backup failed", {
      backupDate,
      scheduledHour,
      backupFolderPath,
      error: message,
    });
  } finally {
    if (demoConnection) {
      await demoConnection.close().catch(() => undefined);
    }
  }
};

const checkAndRunBackup = async (): Promise<void> => {
  if (runInProgress) {
    return;
  }

  const { dateKey, hour } = getZonedClock(new Date(), env.backupTimeZone);
  if (!RETRY_HOURS.has(hour)) {
    return;
  }

  runInProgress = true;
  try {
    const alreadyPassed = await BackupTimelineModel.exists({
      backupDate: dateKey,
      status: "passed",
    });
    if (alreadyPassed) {
      return;
    }

    const alreadyAttemptedThisHour = await BackupTimelineModel.exists({
      backupDate: dateKey,
      scheduledHour: hour,
    });
    if (alreadyAttemptedThisHour) {
      return;
    }

    await runBackupAttempt(dateKey, hour);
  } finally {
    runInProgress = false;
  }
};

export const startBackupScheduler = (): void => {
  if (schedulerTimer) {
    return;
  }

  logger.info("Backup scheduler started", {
    timezone: env.backupTimeZone,
    retryHours: env.backupTimes,
    backupRootDir: path.resolve(process.cwd(), env.backupRootDir),
  });

  void checkAndRunBackup().catch(error => {
    logger.error("Initial backup scheduler check failed", { error: (error as Error).message });
  });

  schedulerTimer = setInterval(() => {
    void checkAndRunBackup().catch(error => {
      logger.error("Backup scheduler check failed", { error: (error as Error).message });
    });
  }, 60 * 1000);
  schedulerTimer.unref();
};

export const stopBackupScheduler = (): void => {
  if (!schedulerTimer) {
    return;
  }
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  logger.info("Backup scheduler stopped");
};
