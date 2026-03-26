/**
 * Email service using nodemailer.
 * Configure SMTP via environment variables:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 * For Gmail: use App Password (not your real password).
 * For production: use SendGrid, Mailgun, or AWS SES SMTP relay.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function getTransporter() {
  try {
    const nodemailer = await import("nodemailer");
    const host = process.env.EMAIL_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.EMAIL_PORT || "587");
    const family = process.env.EMAIL_FAMILY === "6" ? 6 : process.env.EMAIL_FAMILY === "4" ? 4 : undefined;

    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.EMAIL_PORT === "465",
      ...(family ? { family } : {}),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        servername: host,
      },
    });
  } catch {
    return null;
  }
}

export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    // Log OTP to console in dev so you can still test without email setup
    console.log(`[EMAIL DEV] To: ${opts.to} | Subject: ${opts.subject}`);
    const otpMatch = opts.html.match(/\b(\d{6})\b/);
    if (otpMatch) console.log(`[EMAIL DEV] OTP CODE: ${otpMatch[1]}`);
    return true; // Don't block login in dev
  }

  try {
    const transporter = await getTransporter();
    if (!transporter) return false;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"MediSupply Rwanda" <${process.env.EMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
    return false;
  }
}

export function otpEmailHtml(code: string, purpose: "2fa_login" | "email_verify"): string {
  const title = purpose === "2fa_login" ? "Login Verification Code" : "Email Verification";
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#1d4ed8;margin-bottom:8px">MediSupply Rwanda</h2>
    <h3 style="margin-top:0">${title}</h3>
    <p>Your one-time verification code is:</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;padding:16px;background:#eff6ff;border-radius:8px;text-align:center">${code}</div>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    <p style="color:#6b7280;font-size:12px">If you did not request this code, please ignore this email.</p>
  </div>`;
}

export function passwordResetEmailHtml(resetUrl: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#1d4ed8;margin-bottom:8px">MediSupply Rwanda</h2>
    <h3 style="margin-top:0">Reset Your Password</h3>
    <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
    <p style="color:#6b7280;font-size:12px">If you did not request a password reset, ignore this email. Your password will not change.</p>
    <p style="color:#6b7280;font-size:12px;word-break:break-all">Or copy: ${resetUrl}</p>
  </div>`;
}

export function notificationEmailHtml(title: string, message: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#1d4ed8;margin-bottom:8px">MediSupply Rwanda</h2>
    <h3 style="margin-top:0">${title}</h3>
    <p>${message}</p>
    <p style="color:#6b7280;font-size:12px">Login to your dashboard to take action.</p>
  </div>`;
}
