type GraphRequestInput = {
  apiBaseUrl: string;
  objectId: string;
  accessToken: string;
  fields: string;
};

type WhatsAppLineInsights = {
  messagingLimitTier?: string;
  qualityRating?: string;
  conversationAnalytics?: unknown;
  businessInitiatedConversations?: number;
};

const graphGet = async (input: GraphRequestInput): Promise<Record<string, unknown>> => {
  const baseUrl = input.apiBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/${input.objectId}?${new URLSearchParams({ fields: input.fields }).toString()}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { message?: unknown } }).error?.message === "string"
        ? ((body as { error?: { message?: string } }).error?.message as string)
        : `Graph API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (body || {}) as Record<string, unknown>;
};

const sumNestedValueFields = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + sumNestedValueFields(item), 0);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === "number") {
      return obj.value;
    }
    return Object.values(obj).reduce<number>((sum, item) => sum + sumNestedValueFields(item), 0);
  }
  return 0;
};

export const fetchWhatsAppLineInsights = async (input: {
  apiBaseUrl: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  startUnix: number;
  endUnix: number;
}): Promise<WhatsAppLineInsights> => {
  const [tierResponse, qualityResponse, analyticsResponse] = await Promise.all([
    graphGet({
      apiBaseUrl: input.apiBaseUrl,
      objectId: input.phoneNumberId,
      accessToken: input.accessToken,
      fields: "messaging_limit_tier",
    }),
    graphGet({
      apiBaseUrl: input.apiBaseUrl,
      objectId: input.phoneNumberId,
      accessToken: input.accessToken,
      fields: "quality_rating",
    }),
    graphGet({
      apiBaseUrl: input.apiBaseUrl,
      objectId: input.wabaId,
      accessToken: input.accessToken,
      fields:
        `conversation_analytics.start(${input.startUnix}).end(${input.endUnix}).granularity(MONTHLY).` +
        `conversation_directions(["business_initiated"]).dimensions(["conversation_type","conversation_direction"])`,
    }),
  ]);

  const conversationAnalytics = analyticsResponse.conversation_analytics;
  const businessInitiatedConversations = sumNestedValueFields(conversationAnalytics);

  return {
    messagingLimitTier:
      typeof tierResponse.messaging_limit_tier === "string"
        ? tierResponse.messaging_limit_tier
        : undefined,
    qualityRating:
      typeof qualityResponse.quality_rating === "string"
        ? qualityResponse.quality_rating
        : undefined,
    conversationAnalytics,
    businessInitiatedConversations,
  };
};
