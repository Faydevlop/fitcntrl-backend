export const outboundCore = {
  async sendReminder(payload: unknown) {
    return { action: "send-reminder", payload };
  },
  async sendReport(payload: unknown) {
    return { action: "send-report", payload };
  }
};
