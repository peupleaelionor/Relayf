import { Resend } from "resend";
import { createLogger } from "@relayflow/logger";

const logger = createLogger({ name: "email" });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string | null;
  error?: string;
}

export interface EmailClientConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email client
// ─────────────────────────────────────────────────────────────────────────────

export class EmailClient {
  private resend: Resend;
  private from: string;
  private fromName: string;

  constructor(config: EmailClientConfig) {
    this.resend = new Resend(config.apiKey);
    this.from = config.from;
    this.fromName = config.fromName;
  }

  private formatAddress(recipient: EmailRecipient): string {
    if (recipient.name) {
      return `${recipient.name} <${recipient.email}>`;
    }
    return recipient.email;
  }

  private formatAddresses(recipients: EmailRecipient | EmailRecipient[]): string[] {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    return list.map((r) => this.formatAddress(r));
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const toList = this.formatAddresses(options.to);
    const from = `${this.fromName} <${this.from}>`;

    try {
      const result = await this.resend.emails.send({
        from,
        to: toList,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        cc: options.cc ? this.formatAddresses(options.cc) : undefined,
        bcc: options.bcc ? this.formatAddresses(options.bcc) : undefined,
        tags: options.tags,
        headers: options.headers,
      });

      if (result.error) {
        logger.error({ error: result.error }, "Failed to send email via Resend");
        return { success: false, messageId: null, error: result.error.message };
      }

      logger.info({ messageId: result.data?.id, to: toList }, "Email sent successfully");
      return { success: true, messageId: result.data?.id ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err, to: toList }, "Email send exception");
      return { success: false, messageId: null, error: message };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built transactional email templates
// ─────────────────────────────────────────────────────────────────────────────

export interface WelcomeEmailData {
  userName: string;
  workspaceName: string;
  dashboardUrl: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="color:#6366f1">Welcome to RelayFlow, ${data.userName}! 🚀</h1>
  <p>Your workspace <strong>${data.workspaceName}</strong> is ready.</p>
  <p>You can now start sending campaigns, managing contacts, and integrating via our API.</p>
  <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
    Open Dashboard →
  </a>
  <p style="color:#666;font-size:13px;margin-top:32px">
    Need help? Reply to this email or check out our documentation.
  </p>
  <p style="color:#999;font-size:12px">RelayFlow Inc. · You're receiving this because you signed up.</p>
</body>
</html>`;

  const text = `Welcome to RelayFlow, ${data.userName}!

Your workspace "${data.workspaceName}" is ready.

Open your dashboard: ${data.dashboardUrl}

Need help? Reply to this email.`;

  return { html, text };
}

export interface PasswordResetEmailData {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): {
  html: string;
  text: string;
} {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2>Reset your password</h2>
  <p>Hi ${data.userName}, we received a request to reset your RelayFlow password.</p>
  <a href="${data.resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
    Reset Password →
  </a>
  <p style="color:#666">This link expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
  <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;

  const text = `Reset your RelayFlow password

Hi ${data.userName}, we received a request to reset your password.

Reset link (expires in ${data.expiresInMinutes} minutes): ${data.resetUrl}

If you didn't request this, ignore this email.`;

  return { html, text };
}

export interface InviteEmailData {
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
  expiresInHours: number;
}

export function renderInviteEmail(data: InviteEmailData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2>You've been invited to RelayFlow</h2>
  <p><strong>${data.inviterName}</strong> invited you to join the <strong>${data.workspaceName}</strong> workspace.</p>
  <a href="${data.inviteUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
    Accept Invitation →
  </a>
  <p style="color:#666">This invitation expires in ${data.expiresInHours} hours.</p>
</body>
</html>`;

  const text = `You've been invited to RelayFlow

${data.inviterName} invited you to join "${data.workspaceName}".

Accept invitation (expires in ${data.expiresInHours} hours): ${data.inviteUrl}`;

  return { html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createEmailClient(config: EmailClientConfig): EmailClient {
  return new EmailClient(config);
}

// Lazy singleton – only initialized when first accessed
let _defaultClient: EmailClient | null = null;

export function getDefaultEmailClient(): EmailClient {
  if (!_defaultClient) {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    _defaultClient = new EmailClient({
      apiKey,
      from: process.env["EMAIL_FROM"] ?? "noreply@relayflow.io",
      fromName: process.env["EMAIL_FROM_NAME"] ?? "RelayFlow",
    });
  }
  return _defaultClient;
}
