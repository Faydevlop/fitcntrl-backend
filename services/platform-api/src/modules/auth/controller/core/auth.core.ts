import { createHash, randomInt } from "crypto";
import { PasswordResetTokenModel } from "../../model/password-reset-token.model";
import { UserModel } from "../../model/user.model";
import { sendResetOtpEmail } from "../../service/otp-mail.service";

const RESET_OTP_TTL_MINUTES = 10;

type ForgotPasswordPayload = { email?: string };
type VerifyCodePayload = { email?: string; code?: string };
type ResetPasswordPayload = { email?: string; code?: string; newPassword?: string };

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

export const authCore = {
  async login(payload: unknown) {
    return { action: "login", payload, note: "Implement JWT auth logic" };
  },
  async forgotPassword(payload: unknown) {
    const { email } = payload as ForgotPasswordPayload;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("email is required");
    }

    const user = await UserModel.findOne({ email: normalizedEmail }).select("_id email").lean();
    if (!user) {
      return {
        action: "forgot-password",
        email: normalizedEmail,
        sent: true,
        expiresInMinutes: RESET_OTP_TTL_MINUTES
      };
    }

    const otpCode = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);

    await PasswordResetTokenModel.findOneAndUpdate(
      { userId: user._id, channel: "email" },
      {
        codeHash: hashValue(otpCode),
        expiresAt,
        attempts: 0,
        verifiedAt: undefined
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendResetOtpEmail(normalizedEmail, otpCode, RESET_OTP_TTL_MINUTES);

    return {
      action: "forgot-password",
      email: normalizedEmail,
      sent: true,
      expiresInMinutes: RESET_OTP_TTL_MINUTES
    };
  },
  async verifyCode(payload: unknown) {
    const { email, code } = payload as VerifyCodePayload;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !code) {
      throw new Error("email and code are required");
    }

    const user = await UserModel.findOne({ email: normalizedEmail }).select("_id").lean();
    if (!user) {
      throw new Error("Invalid email or code");
    }

    const token = await PasswordResetTokenModel.findOne({
      userId: user._id,
      channel: "email",
      expiresAt: { $gt: new Date() }
    });

    if (!token || token.codeHash !== hashValue(code)) {
      if (token) {
        token.attempts += 1;
        await token.save();
      }
      throw new Error("Invalid email or code");
    }

    token.verifiedAt = new Date();
    await token.save();

    return { action: "verify-code", verified: true };
  },
  async resetPassword(payload: unknown) {
    const { email, code, newPassword } = payload as ResetPasswordPayload;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !code || !newPassword) {
      throw new Error("email, code and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new Error("newPassword must be at least 8 characters");
    }

    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      throw new Error("Invalid reset request");
    }

    const token = await PasswordResetTokenModel.findOne({
      userId: user._id,
      channel: "email",
      expiresAt: { $gt: new Date() }
    });

    if (!token || token.codeHash !== hashValue(code)) {
      throw new Error("Invalid reset request");
    }

    user.passwordHash = hashValue(newPassword);
    await user.save();
    await PasswordResetTokenModel.deleteMany({ userId: user._id, channel: "email" });

    return { action: "reset-password", reset: true };
  },
  async me(userContext: unknown) {
    return { action: "me", userContext, note: "Implement current user profile fetch logic" };
  }
};
