import { Request, Response } from "express";
import { authCore } from "./core/auth.core";
import { ok } from "../../../common/utils/http";

export const authController = {
  async login(req: Request, res: Response) {
    const data = await authCore.login(req.body);
    return ok(res, data, "Login handled");
  },
  async forgotPassword(req: Request, res: Response) {
    const data = await authCore.forgotPassword(req.body);
    return ok(res, data, "Forgot password request handled");
  },
  async verifyCode(req: Request, res: Response) {
    const data = await authCore.verifyCode(req.body);
    return ok(res, data, "Verify code handled");
  },
  async resetPassword(req: Request, res: Response) {
    const data = await authCore.resetPassword(req.body);
    return ok(res, data, "Reset password handled");
  },
  async me(req: Request, res: Response) {
    const data = await authCore.me({ userId: (req as any).authContext?.userId });
    return ok(res, data, "Profile fetched");
  }
};
