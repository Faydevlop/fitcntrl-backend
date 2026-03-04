import { PLATFORM_TYPE_VALUES, PlatformType } from "./enums";

export const OWNER_PLATFORM_TYPES = PLATFORM_TYPE_VALUES;

export type PlatformOptions = {
  planTypes: string[];
  memberStatuses: string[];
  paymentMethods: string[];
  categories: string[];
  employeeRoles: string[];
};

export const PLATFORM_OPTIONS: Record<`${PlatformType}_options`, PlatformOptions> = {
  gym_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["Weight Loss", "Strength", "Cardio", "General Fitness", "Bodybuilding"],
    employeeRoles: ["trainer", "manager", "front_desk", "support"],
  },
  yoga_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["Morning Batch", "Evening Batch", "Beginner", "Advanced", "Prenatal Yoga"],
    employeeRoles: ["instructor", "manager", "front_desk", "support"],
  },
  fitness_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["HIIT", "Zumba", "Aerobics", "CrossFit", "Pilates"],
    employeeRoles: ["coach", "manager", "front_desk", "support"],
  },
  dance_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["HipHop", "Classical", "Kids", "Bollywood", "Contemporary"],
    employeeRoles: ["instructor", "manager", "front_desk", "support"],
  },
  personal_training_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["1-on-1", "Group (2-3)", "Online", "Assessment", "Rehabilitation"],
    employeeRoles: ["trainer", "nutritionist", "manager", "support"],
  },
  other_options: {
    planTypes: ["monthly", "quarterly", "yearly"],
    memberStatuses: ["active", "paused", "expired", "blacklisted"],
    paymentMethods: ["cash", "upi", "card", "online"],
    categories: ["General", "Premium", "Basic"],
    employeeRoles: ["manager", "staff", "support"],
  },
};

export const DEFAULT_OWNER_PLATFORM_TYPE: PlatformType = "gym";

