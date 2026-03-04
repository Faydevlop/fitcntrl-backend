import { Request, Response } from "express";
import { ok } from "../../../common/utils/http";
import { constantsCore } from "./core/constants.core";

export const constantsController = {
  async getAll(_req: Request, res: Response) {
    return ok(res, constantsCore.getAll(), "Constants fetched successfully");
  },
};

