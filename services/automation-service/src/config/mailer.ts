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
    verify?: () => Promise<boolean>;
};

let nodemailerModule: null | { createTransport: (options: unknown) => MailTransport } = null;
try {
    nodemailerModule = require("nodemailer");
} catch {
    nodemailerModule = null;
}

export const mailer = hasSmtpConfig
    ? nodemailerModule?.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
            user: env.smtpUser,
            pass: env.smtpPass,
        },
    })
    : null;

export const isMailerConfigured = (): boolean => Boolean(mailer && nodemailerModule);

export const verifyMailerConnection = async (): Promise<boolean> => {
    if (!mailer || typeof mailer.verify !== "function") {
        return false;
    }
    await mailer.verify();
    return true;
};
