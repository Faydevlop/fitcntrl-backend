import { OWNER_PLATFORM_TYPES, PLATFORM_OPTIONS } from "../../../../common/constants/constants";

export const constantsCore = {
  getAll() {
    return {
      platformTypes: OWNER_PLATFORM_TYPES,
      ...PLATFORM_OPTIONS,
    };
  },
};

