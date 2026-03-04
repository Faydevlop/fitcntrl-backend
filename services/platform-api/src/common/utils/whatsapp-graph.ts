type SendWhatsAppTextInput = {
  apiBaseUrl: string;
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  message: string;
};

export const normalizeWhatsAppRecipient = (phone: string): string => {
  return phone.replace(/[^\d]/g, "");
};

export const sendWhatsAppTextViaGraph = async (input: SendWhatsAppTextInput) => {
  const endpoint = `${input.apiBaseUrl.replace(/\/+$/, "")}/${input.phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.recipientPhone,
      type: "text",
      text: {
        preview_url: false,
        body: input.message,
      },
    }),
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

  return parsedBody;
};
