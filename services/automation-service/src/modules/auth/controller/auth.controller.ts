import { Request, Response } from "express";
import { authCore } from "./core/auth.core";
import { ok } from "../../../common/utils/http";

export const authController = {
    async login(req: Request, res: Response) {
        const data = await authCore.login(req.body, req.db);
        return ok(res, data, "Logged in successfully");
    },
    async forgotPassword(req: Request, res: Response) {
        const data = await authCore.forgotPassword(req.body, req.db);
        return ok(res, data, "OTP sent successfully. Please check your email.");
    },
    async verifyCode(req: Request, res: Response) {
        const data = await authCore.verifyCode(req.body, req.db);
        return ok(res, data, "OTP verified and password updated successfully.");
    },
    async resetPassword(req: Request, res: Response) {
        const data = await authCore.changePassword(req.body, req.authContext?.userId, req.db);
        return ok(res, data, "Password updated successfully.");
    },
    async me(req: Request, res: Response) {
        const data = await authCore.me({ userId: req.authContext?.userId }, req.db);
        return ok(res, data, "User profile retrieved successfully.");
    },
};
