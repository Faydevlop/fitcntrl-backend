import { Request, Response } from "express";
import { created, ok } from "../../../common/utils/http";
import { gymCore } from "./core/gym.core";

export const gymController = {
  async dashboardStats(req: Request, res: Response) {
    return ok(
      res,
      await gymCore.dashboardStats({ auth: req.authContext, query: req.query }),
      "Dashboard stats fetched successfully"
    );
  },
  async dashboardGrowth(req: Request, res: Response) {
    return ok(
      res,
      await gymCore.dashboardGrowth({ auth: req.authContext, query: req.query }),
      "Dashboard growth fetched successfully"
    );
  },
  async listMembers(req: Request, res: Response) {
    return ok(res, await gymCore.listMembers(req.query, req.authContext), "Members fetched successfully");
  },
  async createMember(req: Request, res: Response) {
    return created(res, await gymCore.createMember(req.body, req.authContext), "Member created successfully");
  },
  async getMemberById(req: Request, res: Response) {
    return ok(res, await gymCore.getMemberById(req.params.id, req.authContext), "Member fetched successfully");
  },
  async updateMember(req: Request, res: Response) {
    return ok(
      res,
      await gymCore.updateMember(req.params.id, req.body, req.authContext),
      "Member updated successfully"
    );
  },
  async deleteMember(req: Request, res: Response) {
    return ok(res, await gymCore.deleteMember(req.params.id, req.authContext), "Member removed successfully");
  },
  async listPayments(req: Request, res: Response) {
    return ok(res, await gymCore.listPayments(req.query, req.authContext), "Payments fetched successfully");
  },
  async createPayment(req: Request, res: Response) {
    return created(res, await gymCore.createPayment(req.body, req.authContext), "Payment recorded successfully");
  },
  async pendingPayments(req: Request, res: Response) {
    return ok(
      res,
      await gymCore.pendingPayments(req.query, req.authContext),
      "Pending payments fetched successfully"
    );
  },
  async billingSummary(req: Request, res: Response) {
    return ok(
      res,
      await gymCore.billingSummary({ auth: req.authContext, query: req.query }),
      "Billing fetched successfully"
    );
  },
  async createSupportTicket(req: Request, res: Response) {
    return created(
      res,
      await gymCore.createSupportTicket(req.body, req.authContext),
      "Support ticket created successfully"
    );
  }
};
