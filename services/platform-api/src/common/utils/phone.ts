const toDigits = (value: string): string => value.replace(/[^\d]/g, "");

export const normalizeCountryCode = (value: string | undefined, fallback = "91"): string => {
  const raw = (value || "").trim();
  const digits = toDigits(raw || fallback);
  if (!digits) {
    return toDigits(fallback);
  }
  return digits;
};

export const composePhoneWithCountryCode = (
  countryCode: string | undefined,
  phone: string | undefined,
): string => {
  const rawPhone = (phone || "").trim();
  if (!rawPhone) {
    return "";
  }
  if (rawPhone.startsWith("+")) {
    return toDigits(rawPhone);
  }

  const phoneDigits = toDigits(rawPhone);
  if (!phoneDigits) {
    return "";
  }

  return `${normalizeCountryCode(countryCode)}${phoneDigits}`;
};
