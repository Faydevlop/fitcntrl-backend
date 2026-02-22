export const gymCore = {
  async dashboardStats(context: unknown) {
    return { action: "gym-dashboard-stats", context };
  },
  async dashboardGrowth(context: unknown) {
    return { action: "gym-dashboard-growth", context };
  },
  async listMembers(query: unknown) {
    return { action: "list-members", query };
  },
  async createMember(payload: unknown) {
    return { action: "create-member", payload };
  },
  async getMemberById(id: string) {
    return { action: "get-member", id };
  },
  async updateMember(id: string, payload: unknown) {
    return { action: "update-member", id, payload };
  },
  async deleteMember(id: string) {
    return { action: "delete-member", id };
  },
  async listPayments(query: unknown) {
    return { action: "list-payments", query };
  },
  async createPayment(payload: unknown) {
    return { action: "create-payment", payload };
  },
  async pendingPayments(query: unknown) {
    return { action: "pending-payments", query };
  },
  async billingSummary(context: unknown) {
    return { action: "billing-summary", context };
  },
  async createSupportTicket(payload: unknown) {
    return { action: "create-support-ticket", payload };
  }
};
