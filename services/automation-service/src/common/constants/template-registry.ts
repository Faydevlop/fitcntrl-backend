import templateRegistry from "./templates.json";

export type TemplateConfig = {
  name: string;
  messageType: "template" | "text";
  language?: string;
  category?: string;
  variableKeys?: string[];
  text?: string;
};

type TemplateRegistry = {
  templates: Record<string, TemplateConfig>;
};

export type TemplateName = keyof TemplateRegistry["templates"] & string;

export const TEMPLATE_NAMES = {
  MEMBER_WELCOME: "member_welcome",
  PAYMENT_RECEIVED: "payment_received",
  PAYMENT_DUE_REMINDER: "payment_due_reminder",
  MEMBER_PAYMENT_REMINDER_1: "member_payment_reminder_1",
  OWNER_COMMAND_RESPONSE: "owner_command_response",
  OWNER_PENDING_REPORT: "owner_pending_report",
} as const satisfies Record<string, TemplateName>;

export const TEMPLATE_REGISTRY = templateRegistry as TemplateRegistry;

export const getTemplateConfig = (templateName: string): TemplateConfig | null => {
  const key = templateName as TemplateName;
  return TEMPLATE_REGISTRY.templates[key] || null;
};
