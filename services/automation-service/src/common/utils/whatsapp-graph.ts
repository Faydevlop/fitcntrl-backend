type GraphClientConfig = {
  apiBaseUrl: string;
  phoneNumberId: string;
  accessToken: string;
};

const postGraphMessage = async (
  config: GraphClientConfig,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const endpoint = `${config.apiBaseUrl.replace(/\/+$/, "")}/${config.phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const errorMessage =
      typeof parsedBody === "object" &&
      parsedBody !== null &&
      "error" in parsedBody &&
      typeof (parsedBody as { error?: { message?: unknown } }).error?.message === "string"
        ? ((parsedBody as { error?: { message?: string } }).error?.message as string)
        : `Graph API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return (parsedBody || {}) as Record<string, unknown>;
};

export const sendWhatsAppTextMessage = async (
  config: GraphClientConfig,
  to: string,
  text: string,
): Promise<Record<string, unknown>> => {
  return postGraphMessage(config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  });
};

export const sendWhatsAppTemplateMessage = async (
  config: GraphClientConfig,
  input: {
    to: string;
    templateName: string;
    languageCode: string;
    bodyParameters: string[];
  },
): Promise<Record<string, unknown>> => {
  return postGraphMessage(config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: "body",
          parameters: input.bodyParameters.map(value => ({ type: "text", text: value })),
        },
      ],
    },
  });
};

export const readProviderMessageId = (providerResponse: Record<string, unknown>): string | undefined => {
  const messages = providerResponse.messages as Array<{ id?: string }> | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return undefined;
  }
  const firstMessageId = messages[0]?.id;
  return typeof firstMessageId === "string" && firstMessageId.trim() ? firstMessageId : undefined;
};
