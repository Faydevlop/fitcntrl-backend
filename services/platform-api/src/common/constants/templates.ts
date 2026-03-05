import templateRegistry from "./templates.json";

export type TemplateConfig = {
  name: string;
  language: string;
  category: string;
  variableKeys: string[];
  bodyText?: string;
};

type TemplateRegistry = {
  templates: Record<string, TemplateConfig>;
  messages: {
    announcementPrefix: string;
  };
};

export type TemplateName = keyof TemplateRegistry["templates"] & string;

export const TEMPLATE_NAMES: Record<
  "MEMBER_WELCOME" | "PAYMENT_RECEIVED" | "MEMBER_PAYMENT_REMINDER_1" | "ANNOUNCEMENT_BROADCAST",
  TemplateName
> = {
  MEMBER_WELCOME: "member_welcome",
  PAYMENT_RECEIVED: "payment_received",
  MEMBER_PAYMENT_REMINDER_1: "member_payment_reminder_1",
  ANNOUNCEMENT_BROADCAST: "announcement_broadcast",
};

export const MESSAGE_CONSTANTS = {
  ANNOUNCEMENT_PREFIX: templateRegistry.messages.announcementPrefix,
} as const;

export const TEMPLATE_REGISTRY = templateRegistry as TemplateRegistry;

export const getTemplateConfig = (templateName: TemplateName): TemplateConfig => {
  return TEMPLATE_REGISTRY.templates[templateName];
};
