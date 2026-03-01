import { createHmac } from "crypto";
import { env } from "../../config/env";

type JwtPayload = {
  sub: string;
  role: "admin" | "gym_owner";
  gymId?: string;
  exp: number;
  iat: number;
};

const toBase64Url = (input: string): string => Buffer.from(input).toString("base64url");
const fromBase64Url = (input: string): string => Buffer.from(input, "base64url").toString("utf8");

const parseExpiryToSeconds = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  const pattern = /^(\d+)([smhd])?$/;
  const match = normalized.match(pattern);
  if (!match) {
    return 24 * 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return amount * (multipliers[unit] || 1);
};

const signPart = (data: string): string => {
  return createHmac("sha256", env.jwtSecret).update(data).digest("base64url");
};

export const createAccessToken = (payload: {
  sub: string;
  role: "admin" | "gym_owner";
  gymId?: string;
}): { token: string; expiresInSeconds: number } => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = parseExpiryToSeconds(env.jwtExpiresIn);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  const headerPart = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = toBase64Url(JSON.stringify(fullPayload));
  const signaturePart = signPart(`${headerPart}.${payloadPart}`);

  return {
    token: `${headerPart}.${payloadPart}.${signaturePart}`,
    expiresInSeconds,
  };
};

export const verifyAccessToken = (token: string): JwtPayload | null => {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = signPart(`${headerPart}.${payloadPart}`);
  if (expectedSignature !== signaturePart) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart)) as JwtPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
