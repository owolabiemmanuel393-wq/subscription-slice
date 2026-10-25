import nodemailer from "nodemailer";
import { Resend } from "resend";

/**
 * Email service utility for GymLog.
 * Supports:
 * 1. Nodemailer (SMTP / Gmail / Outlook / Ethereal)
 * 2. Resend API
 * 3. Terminal Console (Development Fallback)
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailOptions): Promise<{ success: boolean; id?: string }> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const defaultHtml =
    html ||
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-top: 0;">GymLog</h2>
      <p style="white-space: pre-wrap; font-size: 16px; line-height: 1.6; color: #334155;">${text}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">If you did not request this email, you can safely ignore it.</p>
    </div>`;

  // -------------------------------------------------------------------------
  // 1. Nodemailer (SMTP / Gmail / Custom SMTP Server)
  // -------------------------------------------------------------------------
  if ((provider === "nodemailer" || provider === "smtp") && smtpUser && smtpPass) {
    try {
      const host = process.env.SMTP_HOST || "smtp.gmail.com";
      const port = Number(process.env.SMTP_PORT) || 465;
      const secure = process.env.SMTP_SECURE === "true" || port === 465;
      const from = process.env.EMAIL_FROM || `"GymLog" <${smtpUser}>`;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html: defaultHtml,
      });

      console.log(`[Nodemailer] Email delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, id: info.messageId };
    } catch (err) {
      console.error("[Nodemailer] Failed to send email via SMTP:", err);
      logEmailToTerminal("GymLog (SMTP Fallback)", to, subject, text);
      return { success: true, id: "fallback-console" };
    }
  }

  // -------------------------------------------------------------------------
  // 2. Nodemailer with Ethereal (Zero-config fake web inbox for testing)
  // -------------------------------------------------------------------------
  if (provider === "ethereal") {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: '"GymLog" <noreply@gymlog.app>',
        to,
        subject,
        text,
        html: defaultHtml,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("\n============================================================");
      console.log("📨 ETHEREAL EMAIL PREVIEW URL:");
      console.log(previewUrl);
      console.log("============================================================\n");

      return { success: true, id: info.messageId };
    } catch (err) {
      console.error("[Nodemailer] Ethereal delivery error:", err);
      logEmailToTerminal("GymLog", to, subject, text);
      return { success: true, id: "fallback-console" };
    }
  }

  // -------------------------------------------------------------------------
  // 3. Resend API
  // -------------------------------------------------------------------------
  const resendApiKey = process.env.RESEND_API_KEY;
  if (provider === "resend" && resendApiKey) {
    try {
      const from = process.env.EMAIL_FROM || "GymLog <onboarding@resend.dev>";
      const resend = new Resend(resendApiKey);
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html: defaultHtml,
      });

      if (error) {
        console.error("Resend API error:", error);
        logEmailToTerminal(from, to, subject, text);
        return { success: true, id: "fallback-console" };
      }

      console.log(`[Resend] Email sent to ${to} (ID: ${data?.id})`);
      return { success: true, id: data?.id };
    } catch (err) {
      console.error("Failed to send email via Resend:", err);
      logEmailToTerminal("GymLog", to, subject, text);
      return { success: true, id: "fallback-console" };
    }
  }

  // -------------------------------------------------------------------------
  // 4. Default Terminal Console Fallback
  // -------------------------------------------------------------------------
  const from = process.env.EMAIL_FROM || "GymLog <noreply@gymlog.app>";
  logEmailToTerminal(from, to, subject, text);
  return { success: true, id: `dev-console-${Date.now()}` };
}

function logEmailToTerminal(from: string, to: string, subject: string, text: string) {
  console.log("\n============================================================");
  console.log("📨 OUTBOUND EMAIL (Console / Dev Mode)");
  console.log("============================================================");
  console.log(`From:    ${from}`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log("------------------------------------------------------------");
  console.log("Body:");
  console.log(text);
  console.log("============================================================\n");
}
