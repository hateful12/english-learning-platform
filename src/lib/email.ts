type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends via Resend when `RESEND_API_KEY` is set.
 * For local testing without mail, set `HOMEWORK_REMINDER_LOG_ONLY=1` to log and treat as success.
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.HOMEWORK_REMINDER_LOG_ONLY === "1") {
      console.log("[email:log-only]", { to: opts.to, subject: opts.subject });
      return { ok: true };
    }
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "English platform <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || res.statusText };
  }
  return { ok: true };
}
