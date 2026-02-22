import { Request, Response } from "express";
import { env } from "../../../config/env";
import { ok } from "../../../common/utils/http";
import { webhookCore } from "./core/webhook.core";

export const webhookController = {
  async receive(req: Request, res: Response) {
    const data = await webhookCore.receiveMetaWebhook(req.body);
    return ok(res, data, "Webhook received");
  },
  verify(req: Request, res: Response) {
    const challenge = webhookCore.verifyMetaToken(
      req.query["hub.mode"] as string | undefined,
      req.query["hub.verify_token"] as string | undefined,
      req.query["hub.challenge"] as string | undefined,
      env.webhookVerifyToken
    );

    if (!challenge) {
      return res.status(403).send("Forbidden");
    }

    return res.status(200).send(challenge);
  }
};
