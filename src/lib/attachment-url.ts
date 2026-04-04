/**
 * Homework attachments are stored under /uploads/... and must load from the browser's
 * current origin so CSP img-src/media-src 'self' and HTTPS stay valid.
 */
export function normalizeAttachmentUrl(url: string): string {
  let u = (url ?? "").trim().replace(/\\/g, "/");
  if (!u) return u;

  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      u = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return u;
    }
  }

  // Without a leading slash, the browser resolves against the *current path* (e.g. /teacher/dashboard).
  if (u.startsWith("uploads/")) u = `/${u}`;

  const marker = "/uploads/homework/";
  const pos = u.indexOf(marker);
  if (pos !== -1 && !u.startsWith("/api/uploads/homework/")) {
    u = u.slice(pos);
  }

  // Legacy static path → App Router (reliable img/audio src in production behind PM2/nginx).
  if (u.startsWith("/uploads/homework/")) {
    const name = u.slice("/uploads/homework/".length).split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
    if (name && !name.includes("..")) {
      return `/api/uploads/homework/${name}`;
    }
  }

  if (u.startsWith("/api/uploads/homework/")) return u.split("#")[0];

  if (u.startsWith("/")) return u;
  try {
    const parsed = new URL(u);
    const pathOnly = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (pathOnly.startsWith("/uploads/")) return normalizeAttachmentUrl(pathOnly);
    const devHosts = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
    if (devHosts.has(parsed.hostname)) return normalizeAttachmentUrl(pathOnly);
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
