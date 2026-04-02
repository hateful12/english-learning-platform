import nodemailer from "nodemailer";

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Gmail / SMTP user. Prefer setting `GMAIL_USER` or `EMAIL_USER` in `.env.local`.
 */
function resolveMailUser(): string | undefined {
  const u =
    process.env.GMAIL_USER ??
    process.env.EMAIL_USER ??
    process.env.SMTP_USER ??
    process.env.MAIL_USER;
  const t = u != null ? String(u).trim() : "";
  return t || undefined;
}

/**
 * App password or SMTP password. Tries several keys; strips spaces (Google shows `xxxx xxxx xxxx xxxx`).
 */
function resolveMailPassword(): string | undefined {
  const raw =
    process.env.GMAIL_APP_PASSWORD ??
    process.env.GMAIL_PASSWORD ??
    process.env.EMAIL_APP_PASSWORD ??
    process.env.SMTP_PASS ??
    process.env.SMTP_PASSWORD ??
    process.env.EMAIL_PASSWORD ??
    process.env.MAIL_PASSWORD;
  if (raw == null || !String(raw).trim()) return undefined;
  return String(raw).replace(/\s/g, "");
}

/**
 * Sends via Gmail SMTP (Google Account → App passwords).
 * Set in `.env.local` (server restart required): mail user (`GMAIL_USER` or `EMAIL_USER`) and app password (`GMAIL_APP_PASSWORD` or `SMTP_PASS`).
 * Local testing without mail: `HOMEWORK_REMINDER_LOG_ONLY=1`.
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (process.env.HOMEWORK_REMINDER_LOG_ONLY === "1") {
    console.log("[email:log-only]", { to: opts.to, subject: opts.subject });
    return { ok: true };
  }

  const user = resolveMailUser();
  const pass = resolveMailPassword();
  if (!user) {
    return {
      ok: false,
      error:
        "Mail user missing: set GMAIL_USER or EMAIL_USER in .env.local (same address you created the app password for), then restart the server",
    };
  }
  if (!pass) {
    return {
      ok: false,
      error:
        "Mail password missing: set GMAIL_APP_PASSWORD (or SMTP_PASS / EMAIL_APP_PASSWORD) in .env.local, then restart the server",
    };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: user,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
