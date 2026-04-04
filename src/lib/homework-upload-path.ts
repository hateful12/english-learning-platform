import path from "path";

export const HOMEWORK_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "homework");

/** Public URL for homework uploads (served by App Router GET). */
export function homeworkPublicUrlForFilename(filename: string): string {
  return `/api/uploads/homework/${filename}`;
}

/**
 * Single-segment filename only (e.g. pasted_abc_01dead.png). Returns absolute disk path or null.
 */
export function safeResolvedHomeworkFilePath(fileBasename: string): string | null {
  const name =
    fileBasename
      .trim()
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.split("?")[0]
      ?.split("#")[0] ?? "";
  if (!name || name.includes("..")) return null;
  const full = path.resolve(path.join(HOMEWORK_UPLOAD_DIR, name));
  if (!full.startsWith(path.resolve(HOMEWORK_UPLOAD_DIR))) return null;
  return full;
}

/**
 * Map a stored public URL to a disk path for server-side reads (Whisper, etc.).
 */
export function resolveHomeworkUploadDiskPath(publicUrl: string): string | null {
  if (typeof publicUrl !== "string") return null;
  const trimmed = publicUrl.trim().replace(/\\/g, "/");
  const prefixes = ["/uploads/homework/", "/api/uploads/homework/", "uploads/homework/"];
  let rest: string | null = null;
  for (const p of prefixes) {
    if (trimmed.startsWith(p)) {
      rest = trimmed.slice(p.length);
      break;
    }
  }
  if (rest === null) return null;
  let name = rest.split("/")[0]?.split("?")[0] ?? "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  if (!name || name.includes("..")) return null;
  return safeResolvedHomeworkFilePath(name);
}
