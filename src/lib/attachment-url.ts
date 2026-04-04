/**
 * Homework attachments are stored under /uploads/... and must load from the browser's
 * current origin so CSP img-src/media-src 'self' and HTTPS stay valid.
 */
export function normalizeAttachmentUrl(url: string): string {
  const u = (url ?? "").trim();
  if (!u) return u;
  if (u.startsWith("/")) return u;
  try {
    const parsed = new URL(u);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (path.startsWith("/uploads/")) return path;
    const devHosts = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
    if (devHosts.has(parsed.hostname)) return path;
  } catch {
    /* not a valid absolute URL */
  }
  return u;
}

/** Rewrite attachment list JSON from DB/API for clients. */
export function normalizeAttachmentsJsonField(raw: string | null | undefined): string {
  const s = typeof raw === "string" ? raw : "[]";
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return s;
    const next = arr.map((item: unknown) => {
      if (!item || typeof item !== "object" || !("url" in item)) return item;
      const o = item as { url: unknown };
      if (typeof o.url !== "string") return item;
      return { ...o, url: normalizeAttachmentUrl(o.url) };
    });
    return JSON.stringify(next);
  } catch {
    return s;
  }
}

export function normalizeAttachmentPayloadList(
  list: Array<{ url: string; name: string; type?: string }>
): Array<{ url: string; name: string; type?: string }> {
  return list.map((a) => ({ ...a, url: normalizeAttachmentUrl(a.url) }));
}
