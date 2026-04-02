/** Tags for loremflickr.com (Creative Commons photos). */

export function sanitizeImageTags(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw
    .replace(/[^a-zA-Z0-9,\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!/[a-zA-Z]/.test(t)) return undefined;
  return t;
}

/** Served dimensions from LoremFlickr (larger so UI can shrink without blur). */
export const EXERCISE_IMAGE_WIDTH = 960;
export const EXERCISE_IMAGE_HEIGHT = 640;

/** Photo from keyword tags (pool rotates; no API key). */
export function buildExerciseImageUrl(imageTags: string): string {
  const tags = sanitizeImageTags(imageTags);
  if (!tags) return "";
  const q = tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .join(",");
  if (!q) return "";
  return `https://loremflickr.com/${EXERCISE_IMAGE_WIDTH}/${EXERCISE_IMAGE_HEIGHT}/${q}`;
}
