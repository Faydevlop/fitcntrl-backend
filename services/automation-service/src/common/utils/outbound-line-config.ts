import { Types } from "mongoose";
import {
  GymRefModel,
  PlanRefModel,
  WhatsAppLineRefModel,
} from "../../modules/webhook/model/platform-ref.model";
import { encryptFieldValue } from "./field-crypto";

export type EncryptedOutboundLineConfig = {
  phone: string;
  phoneNumberIdEncrypted: string;
  wabaIdEncrypted: string;
  tokenEncrypted: string;
};

const toEncryptedSenderConfig = (line: {
  phone?: string;
  phoneNumberId?: string;
  wabaId?: string;
  tokenEncrypted?: string;
}): EncryptedOutboundLineConfig => ({
  phone: String(line.phone || ""),
  phoneNumberIdEncrypted: encryptFieldValue(String(line.phoneNumberId || "")),
  wabaIdEncrypted: encryptFieldValue(String(line.wabaId || "")),
  tokenEncrypted: encryptFieldValue(String(line.tokenEncrypted || "")),
});

export const resolveEncryptedOutboundLineConfig = async (input: {
  gymId?: string;
}): Promise<EncryptedOutboundLineConfig | null> => {
  const gymId = String(input.gymId || "").trim();
  const gymObjectId = gymId && Types.ObjectId.isValid(gymId) ? new Types.ObjectId(gymId) : null;

  let isBasicPlan = false;
  let waMode: "shared" | "dedicated" = "shared";

  if (gymObjectId) {
    const gym = await GymRefModel.findById(gymObjectId).select("_id waMode planId").lean();
    if (gym) {
      waMode = gym.waMode === "dedicated" ? "dedicated" : "shared";
      if (gym.planId && Types.ObjectId.isValid(String(gym.planId))) {
        const plan = await PlanRefModel.findById(gym.planId).select("isBasic").lean();
        isBasicPlan = Boolean(plan?.isBasic);
      }
    }
  }

  let selectedLine: {
    phone?: string;
    phoneNumberId?: string;
    wabaId?: string;
    tokenEncrypted?: string;
  } | null = null;

  if (gymObjectId && !isBasicPlan && waMode === "dedicated") {
    selectedLine = await WhatsAppLineRefModel.findOne({ assignedGymId: gymObjectId, isActive: true })
      .select("phone phoneNumberId wabaId tokenEncrypted")
      .lean();
  }

  if (!selectedLine) {
    selectedLine = await WhatsAppLineRefModel.findOne({ setForBasic: true, isActive: true })
      .select("phone phoneNumberId wabaId tokenEncrypted")
      .lean();
  }

  if (!selectedLine) {
    return null;
  }
  if (!selectedLine.phoneNumberId || !selectedLine.tokenEncrypted) {
    return null;
  }

  return toEncryptedSenderConfig(selectedLine);
};
