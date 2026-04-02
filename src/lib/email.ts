import nodemailer from "nodemailer";

type SendResult = { ok: true } | { ok: false; error: string };

/** Default “from” account when `GMAIL_USER` is not set. */
const DEFAULT_GMAIL_USER = "irenn.boiko@gmail.com";

/**
 * Gmail app password from env. Tries several keys; strips spaces (Google shows `xxxx xxxx xxxx xxxx`).
 */
function resolveGmailAppPassword(): string | undefined {
  const raw =
    process.env.GMAIL_APP_PASSWORD ??
    process.env.GMAIL_PASSWORD ??
    process.env.EMAIL_APP_PASSWORD;
  if (raw == null || !String(raw).trim()) return undefined;
  return String(raw).replace(/\s/g, "");
}

/**
 * Sends via Gmail SMTP (Google Account → App passwords).
 * Set `GMAIL_APP_PASSWORD` in `.env.local` (server restart required). Optional: `GMAIL_USER`.
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

  const user = process.env.GMAIL_USER?.trim() || DEFAULT_GMAIL_USER;
  const pass = resolveGmailAppPassword();
  if (!pass) {
    return {
      ok: false,
      error:
        "Gmail app password missing: set GMAIL_APP_PASSWORD in .env.local (see .env.example), then restart `npm run dev`",
    };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
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
