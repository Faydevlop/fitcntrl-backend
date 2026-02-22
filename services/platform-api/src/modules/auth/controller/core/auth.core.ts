export const authCore = {
  async login(payload: unknown) {
    return { action: "login", payload, note: "Implement JWT auth logic" };
  },
  async forgotPassword(payload: unknown) {
    return { action: "forgot-password", payload, note: "Implement reset code dispatch logic" };
  },
  async verifyCode(payload: unknown) {
    return { action: "verify-code", payload, note: "Implement reset code verification logic" };
  },
  async resetPassword(payload: unknown) {
    return { action: "reset-password", payload, note: "Implement password reset logic" };
  },
  async me(userContext: unknown) {
    return { action: "me", userContext, note: "Implement current user profile fetch logic" };
  }
};
