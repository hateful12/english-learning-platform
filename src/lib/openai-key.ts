import fs from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { AuthenticationError, PermissionDeniedError } from "openai";

function normalizeKey(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().replace(/^\uFEFF/, "");
  if (!t) return undefined;
  return t.replace(/^["']/, "").replace(/["']$/, "").trim() || undefined;
}

/** Read OPENAI_API_KEY directly from disk (handles BOM, CRLF, quoted values). */
function readOpenAiKeyFromEnvFiles(projectDir: string): string | undefined {
  const names = [".env.development.local", ".env.local", ".env.development", ".env"];
  for (const name of names) {
    const full = path.join(projectDir, name);
    if (!fs.existsSync(full)) continue;
    let text = fs.readFileSync(full, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== "OPENAI_API_KEY") continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      const n = normalizeKey(val);
      if (n) return n;
    }
  }
  return undefined;
}

/**
 * Resolves OPENAI_API_KEY for API routes. On localhost, re-merges .env* (Next can cache an
 * empty first load) and falls back to reading files directly so values are not blocked by an
 * empty process.env placeholder.
 */
export function getOpenAiApiKey(): string | undefined {
  const projectDir = process.cwd();
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    try {
      loadEnvConfig(projectDir, true, console, true);
    } catch {
      /* ignore */
    }
  }

  let k = normalizeKey(process.env.OPENAI_API_KEY);
  if (k) return k;

  if (isDev) {
    k = readOpenAiKeyFromEnvFiles(projectDir);
    if (k) {
      process.env.OPENAI_API_KEY = k;
      return k;
    }
  }

  if (!isDev) {
    try {
      const { combinedEnv } = loadEnvConfig(projectDir, false, console, false);
      k = normalizeKey(combinedEnv.OPENAI_API_KEY);
      if (k) return k;
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

export function isOpenAiAuthFailure(err: unknown): boolean {
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) return true;
  const o = err as { status?: number; statusCode?: number };
  return o?.status === 401 || o?.status === 403 || o?.statusCode === 401;
}

export function openAiNotConfiguredMessage(): string {
  if (process.env.NODE_ENV === "development") {
    return (
      "Assessment needs an OpenAI key. Add OPENAI_API_KEY=sk-... to .env.local (recommended) or .env in the project root " +
      `under ${path.basename(process.cwd())}, then restart npm run dev. If it still fails, ensure the line has no spaces around =.`
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
