import { env } from "./env";

const hasSmtpConfig = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
type MailTransport = {
  sendMail: (options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<unknown>;
};

let nodemailerModule: null | { createTransport: (options: unknown) => MailTransport } = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailerModule = require("nodemailer");
} catch (_error) {
  nodemailerModule = null;
}

export const mailer = hasSmtpConfig
  ? nodemailerModule?.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      }
    })
  : null;

export const isMailerConfigured = (): boolean => Boolean(mailer && nodemailerModule);
