import { Request, Response } from "express";
import { created, ok } from "../../../common/utils/http";
import { outboundCore } from "./core/outbound.core";
import { checkRedisReady } from "../../../bootstrap/redis";
import { isMongoReady } from "../../../bootstrap/mongo";

export const outboundController = {
  async sendReminder(req: Request, res: Response) {
    const data = await outboundCore.sendReminder(req.body);
    return created(res, data, "Reminder queued");
  },
  async sendReport(req: Request, res: Response) {
    const data = await outboundCore.sendReport(req.body);
    return created(res, data, "Report queued");
  },
  async status(_req: Request, res: Response) {
    const redisReady = await checkRedisReady();
    const mongoReady = isMongoReady();
    return ok(
      res,
      {
        provider: "meta",
        redisReady,
        mongoReady,
      },
      "WhatsApp status fetched",
    );
  },
};
