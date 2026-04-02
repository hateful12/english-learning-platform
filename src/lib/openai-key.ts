/** Normalize OPENAI_API_KEY from env (trim; strip wrapping quotes from .env). */
export function getOpenAiApiKey(): string | undefined {
  const raw = process.env.OPENAI_API_KEY;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  return t.replace(/^["']/, "").replace(/["']$/, "").trim() || undefined;
}

export function openAiNotConfiguredMessage(): string {
  if (process.env.NODE_ENV === "development") {
    return (
      "Assessment needs an OpenAI key. Add OPENAI_API_KEY=sk-... to .env.local (recommended) or .env in the project root, " +
      "then stop and start the dev server again (npm run dev) so Next.js reloads env vars."
    );
  }
  return (
    "Assessment service is not configured. Add OPENAI_API_KEY to .env on the server and run: pm2 restart english-app"
  );
}

export function openAiInvalidKeyMessage(): string {
  const link = "https://platform.openai.com/api-keys";
  if (process.env.NODE_ENV === "development") {
    return (
      `Invalid or expired OpenAI API key. Create a valid key at ${link}, put it in .env.local as OPENAI_API_KEY=sk-..., ` +
      "then restart the dev server (npm run dev)."
    );
  }
  return "Invalid OpenAI API key. The teacher must set OPENAI_API_KEY in .env and restart the app (pm2 restart).";
}
