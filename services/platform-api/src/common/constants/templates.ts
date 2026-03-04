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
  "MEMBER_WELCOME" | "PAYMENT_RECEIVED" | "ANNOUNCEMENT_BROADCAST",
  TemplateName
> = {
  MEMBER_WELCOME: "member_welcome",
  PAYMENT_RECEIVED: "payment_received",
  ANNOUNCEMENT_BROADCAST: "announcement_broadcast",
};

export const MESSAGE_CONSTANTS = {
  ANNOUNCEMENT_PREFIX: templateRegistry.messages.announcementPrefix,
} as const;

export const TEMPLATE_REGISTRY = templateRegistry as TemplateRegistry;

export const getTemplateConfig = (templateName: TemplateName): TemplateConfig => {
  return TEMPLATE_REGISTRY.templates[templateName];
};
