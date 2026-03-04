export type UserRole = "admin" | "gym_owner";
export const PLATFORM_TYPE_VALUES = [
  "gym",
  "yoga",
  "fitness",
  "dance",
  "personal_training",
  "other",
] as const;
export type PlatformType = (typeof PLATFORM_TYPE_VALUES)[number];
export type AccountStatus = "active" | "grace_period" | "frozen" | "suspended";
export type MemberStatus = "active" | "paused" | "expired" | "blacklisted";
export type PaymentMethod = "cash" | "upi" | "card" | "online";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing";
export type PaymentStatus = "paid" | "pending" | "overdue";
export type WhatsAppMode = "shared" | "dedicated";
export type TicketStatus = "open" | "in_progress" | "resolved";
