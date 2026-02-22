export const webhookCore = {
  async receiveMetaWebhook(payload: unknown) {
    return { action: "receive-meta-webhook", payload };
  },
  verifyMetaToken(mode: string | undefined, token: string | undefined, challenge: string | undefined, expectedToken: string) {
    if (mode !== "subscribe" || token !== expectedToken) {
      return null;
    }
    return challenge || "verified";
  }
};
