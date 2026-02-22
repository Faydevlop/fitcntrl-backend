export const statusCore = {
  async health() {
    return { service: "automation-service", status: "ok" };
  }
};
