import { env } from "../../../config/env";
import { isMailerConfigured, mailer } from "../../../config/mailer";

export const sendResetOtpEmail = async (
    toEmail: string,
    otpCode: string,
    expiresInMinutes: number,
): Promise<void> => {
    if (!isMailerConfigured() || !mailer) {
        // Falls back to logging if mailer not configured
        console.log(`[MAIL MOCK] To: ${toEmail}, OTP: ${otpCode}, Expires: ${expiresInMinutes}m`);
        return;
    }

    await mailer.sendMail({
        from: env.mailFrom,
        to: toEmail,
        subject: `${env.appName} password reset OTP`,
        text: `Your OTP for password reset is ${otpCode}. It expires in ${expiresInMinutes} minutes.`,
        html: `<p>Your OTP for password reset is <b>${otpCode}</b>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`,
    });
};
