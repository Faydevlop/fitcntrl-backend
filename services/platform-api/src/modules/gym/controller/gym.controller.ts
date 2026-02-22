import { Request, Response } from "express";
import { created, ok } from "../../../common/utils/http";
import { gymCore } from "./core/gym.core";

export const gymController = {
  async dashboardStats(req: Request, res: Response) {
    return ok(res, await gymCore.dashboardStats({ headers: req.headers }), "Dashboard stats fetched");
  },
  async dashboardGrowth(req: Request, res: Response) {
    return ok(res, await gymCore.dashboardGrowth({ headers: req.headers }), "Dashboard growth fetched");
  },
  async listMembers(req: Request, res: Response) {
    return ok(res, await gymCore.listMembers(req.query), "Members fetched");
  },
  async createMember(req: Request, res: Response) {
    return created(res, await gymCore.createMember(req.body), "Member created");
  },
  async getMemberById(req: Request, res: Response) {
    return ok(res, await gymCore.getMemberById(req.params.id), "Member fetched");
  },
  async updateMember(req: Request, res: Response) {
    return ok(res, await gymCore.updateMember(req.params.id, req.body), "Member updated");
  },
  async deleteMember(req: Request, res: Response) {
    return ok(res, await gymCore.deleteMember(req.params.id), "Member removed");
  },
  async listPayments(req: Request, res: Response) {
    return ok(res, await gymCore.listPayments(req.query), "Payments fetched");
  },
  async createPayment(req: Request, res: Response) {
    return created(res, await gymCore.createPayment(req.body), "Payment recorded");
  },
  async pendingPayments(req: Request, res: Response) {
    return ok(res, await gymCore.pendingPayments(req.query), "Pending payments fetched");
  },
  async billingSummary(req: Request, res: Response) {
    return ok(res, await gymCore.billingSummary({ headers: req.headers }), "Billing fetched");
  },
  async createSupportTicket(req: Request, res: Response) {
    return created(res, await gymCore.createSupportTicket(req.body), "Support ticket created");
  }
};
