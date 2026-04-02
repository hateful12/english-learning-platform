import fs from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import OpenAI, { AuthenticationError, PermissionDeniedError } from "openai";

function normalizeKey(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().replace(/^\uFEFF/, "");
  if (!t) return undefined;
  return t.replace(/^["']/, "").replace(/["']$/, "").trim() || undefined;
}

const ENV_FILE_NAMES = [".env.development.local", ".env.local", ".env.development", ".env"] as const;

function parseEnvLineValue(raw: string): string {
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return val;
}

/** Read OPENAI_API_KEY directly from disk (handles BOM, CRLF, quoted values). */
function readOpenAiKeyFromEnvFiles(projectDir: string): string | undefined {
  for (const name of ENV_FILE_NAMES) {
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
      const n = normalizeKey(parseEnvLineValue(trimmed.slice(eq + 1)));
      if (n) return n;
    }
  }
  return undefined;
}

/** Fill OPENAI_PROJECT_ID / OPENAI_ORG_ID from disk when unset (sk-proj keys often need these). */
function hydrateOpenAiExtraFromDisk(projectDir: string): void {
  const extras = new Set(["OPENAI_PROJECT_ID", "OPENAI_ORG_ID"]);
  for (const name of ENV_FILE_NAMES) {
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
      if (!extras.has(key)) continue;
      if (normalizeKey(process.env[key])) continue;
      const n = normalizeKey(parseEnvLineValue(trimmed.slice(eq + 1)));
      if (n) process.env[key] = n;
    }
  }
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
    hydrateOpenAiExtraFromDisk(projectDir);
  }

  let k = normalizeKey(process.env.OPENAI_API_KEY);
  if (k) return k;

  if (isDev) {
    k = readOpenAiKeyFromEnvFiles(projectDir);
    if (k) {
      process.env.OPENAI_API_KEY = k;
      hydrateOpenAiExtraFromDisk(projectDir);
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

/** OpenAI client for assessments; passes project/org from env (required for many sk-proj-* keys). */
export function createAssessmentOpenAI(apiKey: string): OpenAI {
  const organization = normalizeKey(process.env.OPENAI_ORG_ID);
  const project = normalizeKey(process.env.OPENAI_PROJECT_ID);
  return new OpenAI({
    apiKey,
    ...(organization ? { organization } : {}),
    ...(project ? { project } : {}),
  });
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

export function openAiInvalidKeyMessage(apiKey?: string): string {
  const link = "https://platform.openai.com/api-keys";
  const projectScoped = typeof apiKey === "string" && apiKey.startsWith("sk-proj");
  const hasProject = !!normalizeKey(process.env.OPENAI_PROJECT_ID);

  if (process.env.NODE_ENV === "development") {
    if (projectScoped && !hasProject) {
      return (
        `OpenAI returned invalid_api_key. Keys starting with sk-proj- usually need OPENAI_PROJECT_ID=proj_… in .env.local ` +
        `(and OPENAI_ORG_ID=org-… if your account uses it). Copy those lines from production .env into .env.local, then restart npm run dev. ${link}`
      );
    }
    if (projectScoped && hasProject) {
      return (
        `OpenAI still rejected the key — check that OPENAI_PROJECT_ID / OPENAI_ORG_ID match the project that issued this key, or create a new key in that project. ${link}`
      );
    }
    return `Invalid or expired OpenAI API key. Update OPENAI_API_KEY in .env.local and restart npm run dev. ${link}`;
  }
  return "Invalid OpenAI API key. The teacher must set OPENAI_API_KEY in .env and restart the app (pm2 restart).";
}
