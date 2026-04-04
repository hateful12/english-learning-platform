/** Image files from a paste event (e.g. Print Screen → Ctrl+V). */
export function imageFilesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items?.length) return [];

  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const blob = item.getAsFile();
    if (!blob || blob.size === 0) continue;
    out.push(ensurePastedFileName(blob));
  }
  return out;
}

function ensurePastedFileName(file: File): File {
  const generic =
    !file.name ||
    /^image\.(png|jpe?g|gif|webp)$/i.test(file.name) ||
    file.name === "blob" ||
    file.name === "";
  if (!generic) return file;

  const ext =
    file.type === "image/jpeg" || file.type === "image/jpg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/gif"
          ? "gif"
          : file.type === "image/webp"
            ? "webp"
            : "png";
  return new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type || "image/png" });
}
