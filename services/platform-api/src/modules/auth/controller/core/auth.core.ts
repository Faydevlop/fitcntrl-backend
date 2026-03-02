import { randomInt } from "crypto";
import { sendResetOtpEmail } from "../../service/otp-mail.service";
import { createAccessToken, createRefreshToken } from "../../../../common/utils/token";
import { hashPassword, verifyPassword } from "../../../../common/utils/password";
import { Connection, Types } from "mongoose";
import { SCHEMAS } from "../../model";



type LoginPayload = { email?: string; password?: string };
type ForgotPasswordPayload = { email?: string };
type AuthContextPayload = { userId?: string };



export const authCore = {
  async login(payload: unknown, db: Connection) {
    const { email, password } = payload as LoginPayload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const rawPassword = typeof password === "string" ? password : "";

    if (!normalizedEmail || !rawPassword) {
      throw new Error("email and password are required");
    }

    const user = await db.models[SCHEMAS.USER].findOne({ email: normalizedEmail });

    // Role checking and user existence
    if (!user || !user.isActive || !["admin", "gym_owner"].includes(user.role)) {
      throw new Error("Invalid credentials or unauthorized access");
    }

    const isValid = verifyPassword(rawPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { token: accessToken, expiresInSeconds: accessExpiresIn } = createAccessToken({
      sub: user._id.toString(),
      role: user.role,
      gymId: user.gymId?.toString(),
    });

    const { token: refreshToken, expiresInSeconds: refreshExpiresIn } = createRefreshToken({
      sub: user._id.toString(),
      role: user.role,
      gymId: user.gymId?.toString(),
    });

    // Store tokens in DB
    await db.models[SCHEMAS.ACCESS_TOKEN].create({
      userId: user._id,
      role: user.role,
      token: accessToken,
      expiresAt: new Date(Date.now() + accessExpiresIn * 1000),
    });

    await db.models[SCHEMAS.REFRESH_TOKEN].create({
      userId: user._id,
      role: user.role,
      token: refreshToken,
      expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
    });

    // Audit log (matching project standard)
    if (db.models[SCHEMAS.ACTIVITY_LOG]) {
      await db.models[SCHEMAS.ACTIVITY_LOG].create({
        actorUserId: user._id,
        actorRole: user.role as string,
        action: "Login",
        entityType: "user",
        entityId: user._id.toString(),
        createdAt: new Date(),
      }).catch(() => { });
    }

    return {
      tokenType: "Bearer",
      accessToken,
      refreshToken,
      expiresInSeconds: accessExpiresIn,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        gymId: user.gymId?.toString() || null,
      },
    };
  },
  async forgotPassword(payload: unknown, db: Connection) {
    const { email } = payload as ForgotPasswordPayload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      throw new Error("email is required");
    }

    const user = await (db.models[SCHEMAS.USER].findOne({ email: normalizedEmail }).select("_id email isActive").lean() as unknown as { _id: Types.ObjectId, email: string, isActive: boolean } | null);
    if (!user) {
      throw new Error("User with this email does not exist");
    }
    if (!user.isActive) {
      throw new Error("User account is inactive");
    }

    const otpCode = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.models[SCHEMAS.OTP].findOneAndUpdate(
      { email: normalizedEmail },
      {
        otp: otpCode,
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await sendResetOtpEmail(normalizedEmail, otpCode, 5);

    return {
      action: "forgot-password",
      email: normalizedEmail,
      sent: true,
      expiresInMinutes: 5,
    };
  },
  async verifyCode(payload: unknown, db: Connection) {
    const { email, code, newPassword } = payload as { email?: string; code?: string; newPassword?: string };
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !code || !newPassword) {
      throw new Error("email, code and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new Error("newPassword must be at least 8 characters");
    }

    const otpDoc = await db.models[SCHEMAS.OTP].findOne({
      email: normalizedEmail,
      otp: code,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      throw new Error("Invalid or expired OTP");
    }

    const user = await db.models[SCHEMAS.USER].findOne({ email: normalizedEmail });
    if (!user) {
      throw new Error("User not found");
    }

    user.passwordHash = hashPassword(newPassword);
    await user.save();

    // Clear OTP after successful reset
    await db.models[SCHEMAS.OTP].deleteOne({ _id: otpDoc._id });

    return { success: true, message: "Password updated successfully" };
  },
  async changePassword(payload: unknown, userId: string | undefined, db: Connection) {
    const { oldPassword, newPassword } = payload as { oldPassword?: string; newPassword?: string };

    if (!userId) {
      throw new Error("Authentication required");
    }
    if (!oldPassword || !newPassword) {
      throw new Error("oldPassword and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new Error("newPassword must be at least 8 characters");
    }

    const user = await db.models[SCHEMAS.USER].findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isValid = verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Incorrect old password");
    }

    user.passwordHash = hashPassword(newPassword);
    await user.save();

    return { success: true, message: "Password changed successfully" };
  },
  async me(userContext: unknown, db: Connection) {
    const { userId } = userContext as AuthContextPayload;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid auth context");
    }

    const user = await db.models[SCHEMAS.USER].findById(userId).select("_id email role gymId isActive lastLoginAt");
    if (!user || !user.isActive) {
      throw new Error("User not found");
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      gymId: user.gymId?.toString() || null,
      lastLoginAt: user.lastLoginAt || null,
    };
  },
};
