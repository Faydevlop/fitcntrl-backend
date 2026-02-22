export const adminCore = {
  async listGyms(query: unknown) {
    return { action: "list-gyms", query };
  },
  async createGym(payload: unknown) {
    return { action: "create-gym", payload };
  },
  async getGymById(id: string) {
    return { action: "get-gym", id };
  },
  async updateGym(id: string, payload: unknown) {
    return { action: "update-gym", id, payload };
  },
  async deleteGym(id: string) {
    return { action: "delete-gym", id };
  },
  async freezeGym(id: string) {
    return { action: "freeze-gym", id };
  },
  async unfreezeGym(id: string) {
    return { action: "unfreeze-gym", id };
  },
  async resetGymWa(id: string) {
    return { action: "reset-gym-wa", id };
  },
  async listPlans() {
    return { action: "list-plans" };
  },
  async createPlan(payload: unknown) {
    return { action: "create-plan", payload };
  },
  async updatePlan(id: string, payload: unknown) {
    return { action: "update-plan", id, payload };
  },
  async listSubscriptions(query: unknown) {
    return { action: "list-subscriptions", query };
  },
  async revenueStats(query: unknown) {
    return { action: "revenue-stats", query };
  },
  async listWhatsAppPhones() {
    return { action: "list-whatsapp-phones" };
  },
  async createWhatsAppPhone(payload: unknown) {
    return { action: "create-whatsapp-phone", payload };
  },
  async updateWhatsAppPhone(id: string, payload: unknown) {
    return { action: "update-whatsapp-phone", id, payload };
  },
  async listActivityLogs(query: unknown) {
    return { action: "list-activity-logs", query };
  },
  async listAnnouncements() {
    return { action: "list-announcements" };
  },
  async createAnnouncement(payload: unknown) {
    return { action: "create-announcement", payload };
  },
  async listEnquiries(query: unknown) {
    return { action: "list-enquiries", query };
  },
  async listOwnerSupport(query: unknown) {
    return { action: "list-owner-support", query };
  }
};
