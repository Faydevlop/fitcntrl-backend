import { Request, Response } from "express";
import { adminCore } from "./core/admin.core";
import { created, ok } from "../../../common/utils/http";

export const adminController = {
  async listGyms(req: Request, res: Response) {
    return ok(res, await adminCore.listGyms(req.query), "Gyms fetched");
  },
  async createGym(req: Request, res: Response) {
    return created(res, await adminCore.createGym(req.body), "Gym created");
  },
  async getGymById(req: Request, res: Response) {
    return ok(res, await adminCore.getGymById(req.params.id), "Gym fetched");
  },
  async updateGym(req: Request, res: Response) {
    return ok(res, await adminCore.updateGym(req.params.id, req.body), "Gym updated");
  },
  async deleteGym(req: Request, res: Response) {
    return ok(res, await adminCore.deleteGym(req.params.id), "Gym removed");
  },
  async freezeGym(req: Request, res: Response) {
    return ok(res, await adminCore.freezeGym(req.params.id), "Gym frozen");
  },
  async unfreezeGym(req: Request, res: Response) {
    return ok(res, await adminCore.unfreezeGym(req.params.id), "Gym unfrozen");
  },
  async resetGymWa(req: Request, res: Response) {
    return ok(res, await adminCore.resetGymWa(req.params.id), "Gym WhatsApp usage reset");
  },
  async listPlans(_req: Request, res: Response) {
    return ok(res, await adminCore.listPlans(), "Plans fetched");
  },
  async createPlan(req: Request, res: Response) {
    return created(res, await adminCore.createPlan(req.body), "Plan created");
  },
  async updatePlan(req: Request, res: Response) {
    return ok(res, await adminCore.updatePlan(req.params.id, req.body), "Plan updated");
  },
  async listSubscriptions(req: Request, res: Response) {
    return ok(res, await adminCore.listSubscriptions(req.query), "Subscriptions fetched");
  },
  async revenueStats(req: Request, res: Response) {
    return ok(res, await adminCore.revenueStats(req.query), "Revenue stats fetched");
  },
  async listWhatsAppPhones(_req: Request, res: Response) {
    return ok(res, await adminCore.listWhatsAppPhones(), "WhatsApp phones fetched");
  },
  async createWhatsAppPhone(req: Request, res: Response) {
    return created(res, await adminCore.createWhatsAppPhone(req.body), "WhatsApp phone added");
  },
  async updateWhatsAppPhone(req: Request, res: Response) {
    return ok(res, await adminCore.updateWhatsAppPhone(req.params.id, req.body), "WhatsApp phone updated");
  },
  async listActivityLogs(req: Request, res: Response) {
    return ok(res, await adminCore.listActivityLogs(req.query), "Activity logs fetched");
  },
  async listAnnouncements(_req: Request, res: Response) {
    return ok(res, await adminCore.listAnnouncements(), "Announcements fetched");
  },
  async createAnnouncement(req: Request, res: Response) {
    return created(res, await adminCore.createAnnouncement(req.body), "Announcement created");
  },
  async listEnquiries(req: Request, res: Response) {
    return ok(res, await adminCore.listEnquiries(req.query), "Enquiries fetched");
  },
  async listOwnerSupport(req: Request, res: Response) {
    return ok(res, await adminCore.listOwnerSupport(req.query), "Owner support tickets fetched");
  }
};
