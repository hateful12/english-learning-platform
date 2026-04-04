/** True if paste likely contains an image file (sync peek; avoids pasting garbage into a textarea). */
export function clipboardHasRenderableImageSync(event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items?.length) return false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const blob = item.getAsFile();
    if (blob && blob.size > 0) return true;
  }
  return false;
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "png";
}

/**
 * Image files from a paste event (e.g. Print Screen → Ctrl+V).
 * Copies bytes into new Files so FormData/upload works reliably across browsers.
 */
export async function imageFilesFromClipboard(event: ClipboardEvent): Promise<File[]> {
  const items = event.clipboardData?.items;
  if (!items?.length) return [];

  const out: File[] = [];
  const t0 = Date.now();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const blob = item.getAsFile();
    if (!blob || blob.size === 0) continue;
    const buf = await blob.arrayBuffer();
    if (buf.byteLength === 0) continue;

    const type = blob.type || "image/png";
    const ext = extFromMime(type);
    const generic =
      !blob.name ||
      /^image\.(png|jpe?g|gif|webp)$/i.test(blob.name) ||
      blob.name === "blob" ||
      blob.name === "";
    const name = generic ? `pasted-${t0}-${i}.${ext}` : blob.name.replace(/[^\w.-]/g, "_");
    out.push(new File([buf], name, { type }));
  }
  return out;
}
