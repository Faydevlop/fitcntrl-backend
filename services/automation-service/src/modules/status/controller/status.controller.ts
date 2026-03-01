import { Request, Response } from "express";
import { ok } from "../../../common/utils/http";
import { statusCore } from "./core/status.core";

export const statusController = {
  async health(_req: Request, res: Response) {
    return ok(res, await statusCore.health(), "Service status");
  },
};
