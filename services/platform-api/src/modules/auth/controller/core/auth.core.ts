import { randomInt } from "crypto";
import { Connection, Types } from "mongoose";
import { sendResetOtpEmail } from "../../service/otp-mail.service";
import { createAccessToken, createRefreshToken } from "../../../../common/utils/token";
import { hashPassword, verifyPassword } from "../../../../common/utils/password";
import { normalizeCountryCode } from "../../../../common/utils/phone";
import { DEFAULT_OWNER_PLATFORM_TYPE } from "../../../../common/constants/constants";
import { PLATFORM_TYPE_VALUES, PlatformType } from "../../../../common/constants/enums";
import { SCHEMAS } from "../../model";

type LoginPayload = { email?: string; password?: string };
type SignupPayload = {
  name?: string;
  email?: string;
  countryCode?: string;
  phone?: string;
  password?: string;
};
type ForgotPasswordPayload = { email?: string };
type OnboardingPayload = {
  platformType?: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  city?: string;
  address?: string;
  upiId?: string;
  displayName?: string;
};
type AuthContextPayload = { userId?: string };

const isPlatformType = (value: string): value is PlatformType => {
  return (PLATFORM_TYPE_VALUES as readonly string[]).includes(value);
};

const addMonths = (date: Date, months: number): Date => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};

const getPlanSubscriptionMonths = (plan: { billing?: string; isBasic?: boolean }): number => {
  if (plan.isBasic) return 2;
  return plan.billing === "yearly" ? 12 : 1;
};

const resolveActiveBasicPlan = async (db: Connection) => {
  const basicPlan = await db.models[SCHEMAS.PLAN].findOne({ isBasic: true, active: true });
  if (basicPlan) return basicPlan;
  return db.models[SCHEMAS.PLAN].findOne({ active: true }).sort({ price: 1, createdAt: 1 });
};

const createOwnerGymWithPlan = async (
  db: Connection,
  user: {
    _id: Types.ObjectId;
    name: string;
    countryCode: string;
    phone: string;
    platformType: PlatformType;
  },
  options?: {
    businessName?: string;
    ownerName?: string;
    countryCode?: string;
    phone?: string;
    city?: string;
    address?: string;
    upiId?: string;
    displayName?: string;
  },
) => {
  const plan = await resolveActiveBasicPlan(db);
  if (!plan) {
    throw new Error("No active plan found. Please configure plans before onboarding owners.");
  }

  const now = new Date();
  const startDate = now;
  const expiryDate = addMonths(startDate, getPlanSubscriptionMonths(plan));
  const trialing = Boolean(plan.trialDays && plan.trialDays > 0);
  const subscriptionStatus = trialing ? "trialing" : "active";

  const businessName = options?.businessName?.trim() || `${user.name}'s Studio`;
  const ownerName = options?.ownerName?.trim() || user.name;
  const phone = options?.phone?.trim() || user.phone;
  const city = typeof options?.city === "string" ? options.city.trim() : undefined;
  const address = typeof options?.address === "string" ? options.address.trim() : undefined;
  const upiId = typeof options?.upiId === "string" ? options.upiId.trim() : undefined;
  const displayName = typeof options?.displayName === "string" ? options.displayName.trim() : undefined;

  const gym = await db.models[SCHEMAS.GYM].create({
    name: businessName,
    ownerName,
    ownerUserId: user._id,
    platformType: user.platformType,
    phone,
    city: city || undefined,
    address: address || undefined,
    planId: plan._id,
    status: "active",
    waMode: "shared",
    upiId: upiId || undefined,
    gymDisplayName: displayName || businessName,
    subscription: {
      startDate,
      expiryDate,
      gracePeriodDays: plan.gracePeriodDays || 0,
      autoRenewal: true,
    },
  });

  await db.models[SCHEMAS.SUBSCRIPTION].create({
    gymId: gym._id,
    planId: plan._id,
    status: subscriptionStatus,
    paymentStatus: "pending",
    startDate,
    expiryDate,
    nextBillingDate: expiryDate,
  });

  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  await db.models[SCHEMAS.WHATSAPP_USAGE_MONTHLY].findOneAndUpdate(
    { gymId: gym._id, monthKey },
    {
      gymId: gym._id,
      monthKey,
      planLimit: plan.whatsappLimit,
      messagesUsed: 0,
      messagesFailed: 0,
      conversationsCount: 0,
      deliveryRate: 0,
      daily: [],
    },
    { upsert: true, new: true },
  );

  return { gym, plan };
};

const resolveCurrentPlanId = async (db: Connection, gymId?: Types.ObjectId | null): Promise<string | null> => {
  if (!gymId || !Types.ObjectId.isValid(gymId)) {
    return null;
  }
  const gym = (await db.models[SCHEMAS.GYM]
    .findById(gymId)
    .select("planId")
    .lean()) as { planId?: Types.ObjectId } | null;
  if (!gym?.planId) return null;
  return gym.planId.toString();
};

const issueSession = async (db: Connection, user: {
  _id: Types.ObjectId;
  email: string;
  role: "admin" | "gym_owner";
  gymId?: Types.ObjectId;
  platformType?: PlatformType;
  onboardingComplete?: boolean;
  name?: string;
  countryCode?: string;
  phone?: string;
}) => {
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

  const currentPlanId = await resolveCurrentPlanId(db, user.gymId);

  return {
    tokenType: "Bearer",
    accessToken,
    refreshToken,
    expiresInSeconds: accessExpiresIn,
    user: {
      id: user._id.toString(),
      name: user.name || "",
      email: user.email,
      countryCode: user.countryCode || "91",
      phone: user.phone || "",
      role: user.role,
      gymId: user.gymId?.toString() || null,
      currentPlanId,
      platformType: user.platformType || null,
      onboardingComplete: Boolean(user.onboardingComplete),
    },
  };
};

export const authCore = {
  async login(payload: unknown, db: Connection) {
    const { email, password } = payload as LoginPayload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const rawPassword = typeof password === "string" ? password : "";

    if (!normalizedEmail || !rawPassword) {
      throw new Error("email and password are required");
    }

    const user = await db.models[SCHEMAS.USER].findOne({ email: normalizedEmail });

    if (!user) {
      throw new Error("User not found. Please sign up first.");
    }

    if (!user.isActive) {
      throw new Error("This account is inactive. Please contact support.");
    }

    if (!["admin", "gym_owner"].includes(user.role)) {
      throw new Error("This account is not allowed to login here.");
    }

    const isValid = verifyPassword(rawPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Incorrect password. Please try again.");
    }

    user.lastLoginAt = new Date();
    await user.save();

    if (db.models[SCHEMAS.ACTIVITY_LOG]) {
      await db.models[SCHEMAS.ACTIVITY_LOG].create({
        actorUserId: user._id,
        actorRole: user.role as string,
        action: "Login",
        entityType: "user",
        entityId: user._id.toString(),
        createdAt: new Date(),
      }).catch(() => undefined);
    }

    return issueSession(db, user);
  },

  async signup(payload: unknown, db: Connection) {
    const { name, email, countryCode, phone, password } = payload as SignupPayload;
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedCountryCode = normalizeCountryCode(countryCode);
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const rawPassword = typeof password === "string" ? password : "";

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !rawPassword || !normalizedCountryCode) {
      throw new Error("name, email, countryCode, phone and password are required");
    }
    if (rawPassword.length < 8) {
      throw new Error("password must be at least 8 characters");
    }

    const existing = await db.models[SCHEMAS.USER].findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new Error("Email already registered");
    }

    const user = await db.models[SCHEMAS.USER].create({
      name: normalizedName,
      email: normalizedEmail,
      countryCode: normalizedCountryCode,
      phone: normalizedPhone,
      passwordHash: hashPassword(rawPassword),
      role: "gym_owner",
      platformType: DEFAULT_OWNER_PLATFORM_TYPE,
      onboardingComplete: false,
      isActive: true,
    });

    const { gym } = await createOwnerGymWithPlan(db, {
      _id: user._id,
      name: normalizedName,
      countryCode: normalizedCountryCode,
      phone: normalizedPhone,
      platformType: DEFAULT_OWNER_PLATFORM_TYPE,
    });
    user.gymId = gym._id;
    await user.save();

    if (db.models[SCHEMAS.ACTIVITY_LOG]) {
      await db.models[SCHEMAS.ACTIVITY_LOG].create({
        actorUserId: user._id,
        actorRole: "gym_owner",
        action: "Signup",
        entityType: "user",
        entityId: user._id.toString(),
        createdAt: new Date(),
      }).catch(() => undefined);
    }

    return issueSession(db, user);
  },

  async completeOnboarding(payload: unknown, userContext: unknown, db: Connection) {
    const { userId } = userContext as AuthContextPayload;
    const {
      platformType,
      businessName,
      ownerName,
      phone,
      city,
      address,
      upiId,
      displayName,
    } = payload as OnboardingPayload;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error("Authentication required");
    }

    const normalizedPlatformType = typeof platformType === "string" ? platformType.trim() : "";
    if (!normalizedPlatformType || !isPlatformType(normalizedPlatformType)) {
      throw new Error(`platformType must be one of: ${PLATFORM_TYPE_VALUES.join(", ")}`);
    }

    const normalizedBusinessName = typeof businessName === "string" ? businessName.trim() : "";
    const normalizedOwnerName = typeof ownerName === "string" ? ownerName.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    if (!normalizedBusinessName || !normalizedOwnerName || !normalizedPhone) {
      throw new Error("businessName, ownerName and phone are required");
    }

    const user = await db.models[SCHEMAS.USER].findOne({
      _id: new Types.ObjectId(userId),
      role: "gym_owner",
      isActive: true,
    });
    if (!user) {
      throw new Error("Owner user not found");
    }

    let gym = user.gymId
      ? await db.models[SCHEMAS.GYM].findById(user.gymId)
      : null;

    if (!gym) {
      const created = await createOwnerGymWithPlan(
        db,
        {
          _id: user._id,
          name: normalizedOwnerName,
          countryCode: user.countryCode || "91",
          phone: normalizedPhone,
          platformType: normalizedPlatformType,
        },
        {
          businessName: normalizedBusinessName,
          ownerName: normalizedOwnerName,
          city,
          address,
          upiId,
          displayName,
        },
      );
      gym = created.gym;
    } else {
      gym.name = normalizedBusinessName;
      gym.ownerName = normalizedOwnerName;
      gym.platformType = normalizedPlatformType;
      gym.phone = normalizedPhone;
      if (typeof city === "string") gym.city = city.trim();
      if (typeof address === "string") gym.address = address.trim();
      if (typeof upiId === "string") gym.upiId = upiId.trim();
      if (typeof displayName === "string") gym.gymDisplayName = displayName.trim();
      await gym.save();
    }

    user.name = normalizedOwnerName;
    user.phone = normalizedPhone;
    user.platformType = normalizedPlatformType;
    user.gymId = gym._id;
    user.onboardingComplete = true;
    await user.save();

    if (db.models[SCHEMAS.ACTIVITY_LOG]) {
      await db.models[SCHEMAS.ACTIVITY_LOG].create({
        actorUserId: user._id,
        actorRole: "gym_owner",
        gymId: gym._id,
        action: "Completed Onboarding",
        entityType: "gym",
        entityId: gym._id.toString(),
        createdAt: new Date(),
      }).catch(() => undefined);
    }

    return issueSession(db, user);
  },

  async forgotPassword(payload: unknown, db: Connection) {
    const { email } = payload as ForgotPasswordPayload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      throw new Error("email is required");
    }

    const user = await (
      db.models[SCHEMAS.USER]
        .findOne({ email: normalizedEmail })
        .select("_id email isActive")
        .lean() as unknown as { _id: Types.ObjectId; email: string; isActive: boolean } | null
    );
    if (!user) {
      throw new Error("User with this email does not exist");
    }
    if (!user.isActive) {
      throw new Error("User account is inactive");
    }

    const otpCode = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.models[SCHEMAS.OTP].findOneAndUpdate(
      { email: normalizedEmail },
      { otp: otpCode, expiresAt },
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

    const user = await db.models[SCHEMAS.USER]
      .findById(userId)
      .select("_id name email countryCode phone role platformType onboardingComplete gymId isActive lastLoginAt");
    if (!user || !user.isActive) {
      throw new Error("User not found");
    }

    return {
      id: user._id.toString(),
      name: user.name || "",
      email: user.email,
      countryCode: user.countryCode || "91",
      phone: user.phone || "",
      role: user.role,
      platformType: user.platformType || null,
      onboardingComplete: Boolean(user.onboardingComplete),
      gymId: user.gymId?.toString() || null,
      currentPlanId: await resolveCurrentPlanId(db, user.gymId),
      lastLoginAt: user.lastLoginAt || null,
    };
  },
};
