import { Request, Response } from "express";
import { adminCore } from "./core/admin.core";
import { created, ok } from "../../../common/utils/http";

export const adminController = {
  async listGyms(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listGyms(input, req.db), "Gyms fetched successfully");
  },
  async createGym(req: Request, res: Response) {
    return created(res, await adminCore.createGym(req.body, req), "Gym created successfully");
  },
  async getGymById(req: Request, res: Response) {
    return ok(res, await adminCore.getGymById(req.params.id, req.db), "Gym fetched successfully");
  },
  async updateGym(req: Request, res: Response) {
    return ok(res, await adminCore.updateGym(req.params.id, req.body, req), "Gym updated successfully");
  },
  async deleteGym(req: Request, res: Response) {
    return ok(res, await adminCore.deleteGym(req.params.id, req), "Gym suspended successfully");
  },
  async freezeGym(req: Request, res: Response) {
    return ok(res, await adminCore.freezeGym(req.params.id, req), "Gym frozen successfully");
  },
  async unfreezeGym(req: Request, res: Response) {
    return ok(res, await adminCore.unfreezeGym(req.params.id, req), "Gym unfrozen successfully");
  },
  async resetGymWa(req: Request, res: Response) {
    return ok(res, await adminCore.resetGymWa(req.params.id, req), "Gym WhatsApp usage reset successfully");
  },
  async listPlans(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listPlans(input, req.db), "Plans fetched successfully");
  },
  async createPlan(req: Request, res: Response) {
    return created(res, await adminCore.createPlan(req.body, req), "Plan created successfully");
  },
  async updatePlan(req: Request, res: Response) {
    return ok(res, await adminCore.updatePlan(req.params.id, req.body, req), "Plan updated successfully");
  },
  async listSubscriptions(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listSubscriptions(input, req.db), "Subscriptions fetched successfully");
  },
  async listSubscriptionPayments(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(
      res,
      await adminCore.listSubscriptionPayments(input, req.db),
      "Subscription payments fetched successfully",
    );
  },
  async revenueStats(req: Request, res: Response) {
    return ok(res, await adminCore.revenueStats(req.query), "Revenue stats fetched successfully");
  },
  async listWhatsAppPhones(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listWhatsAppPhones(input, req.db), "WhatsApp phones fetched successfully");
  },
  async createWhatsAppPhone(req: Request, res: Response) {
    return created(
      res,
      await adminCore.createWhatsAppPhone(req.body, req),
      "WhatsApp phone added successfully",
    );
  },
  async getWhatsAppPhoneById(req: Request, res: Response) {
    return ok(
      res,
      await adminCore.getWhatsAppPhoneById(req.params.id, req),
      "WhatsApp phone fetched successfully",
    );
  },
  async updateWhatsAppPhone(req: Request, res: Response) {
    return ok(
      res,
      await adminCore.updateWhatsAppPhone(req.params.id, req.body, req),
      "WhatsApp phone updated successfully",
    );
  },
  async listActivityLogs(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listActivityLogs(input, req.db), "Activity logs fetched successfully");
  },
  async listAnnouncements(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listAnnouncements(input, req.db), "Announcements fetched successfully");
  },
  async createAnnouncement(req: Request, res: Response) {
    return created(
      res,
      await adminCore.createAnnouncement(req.body, req),
      "Announcement created successfully",
    );
  },
  async listEnquiries(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listEnquiries(input, req.db), "Enquiries fetched successfully");
  },
  async updateEnquiry(req: Request, res: Response) {
    return ok(res, await adminCore.updateEnquiry(req.params.id, req.body, req), "Enquiry updated successfully");
  },
  async listOwnerSupport(req: Request, res: Response) {
    const input = req.method === "POST" ? req.body : req.query;
    return ok(res, await adminCore.listOwnerSupport(input, req.db), "Owner support tickets fetched successfully");
  },
  async updateOwnerSupport(req: Request, res: Response) {
    return ok(
      res,
      await adminCore.updateOwnerSupport(req.params.id, req.body, req),
      "Owner support ticket updated successfully",
    );
  },
};
