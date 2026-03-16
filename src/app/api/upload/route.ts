import { NextRequest, NextResponse } from "next/server";
import { isTeacherLoggedIn } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "homework");

const ALLOWED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/x-m4a"],
  archive: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/gzip",
  ],
};

function getAllowedExtensions(): Set<string> {
  const exts = new Set<string>();
  ["jpg", "jpeg", "png", "gif", "webp", "mp3", "wav", "ogg", "webm", "m4a", "zip", "rar", "7z", "gz"].forEach((e) => exts.add(e.toLowerCase()));
  return exts;
}

const EXT_TO_CATEGORY: Record<string, "image" | "audio" | "archive"> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  mp3: "audio", wav: "audio", ogg: "audio", webm: "audio", m4a: "audio",
  zip: "archive", rar: "archive", "7z": "archive", gz: "archive",
};

function getCategory(mime: string, ext: string): "image" | "audio" | "archive" | null {
  if (mime && ALLOWED_TYPES.image.includes(mime)) return "image";
  if (mime && ALLOWED_TYPES.audio.includes(mime)) return "audio";
  if (mime && ALLOWED_TYPES.archive.includes(mime)) return "archive";
  // Browsers often send empty or generic MIME (e.g. application/octet-stream) for audio; allow by extension
  if (ext && EXT_TO_CATEGORY[ext]) return EXT_TO_CATEGORY[ext];
  return null;
}

function safeName(original: string): string {
  const ext = path.extname(original).toLowerCase() || "";
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80) || "file";
  const unique = randomBytes(8).toString("hex");
  return `${base}_${unique}${ext}`;
}

export async function POST(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mime = file.type || "";
  const ext = path.extname(file.name).toLowerCase().slice(1);
  const allowedExts = getAllowedExtensions();
  if (!ext || !allowedExts.has(ext)) {
    return NextResponse.json({ error: "File extension not allowed." }, { status: 400 });
  }

  const category = getCategory(mime, ext);
  if (!category) {
    return NextResponse.json(
      { error: "File type not allowed. Use photo, audio, or archive (zip, rar, 7z)." },
      { status: 400 }
    );
  }

  const maxSize = 25 * 1024 * 1024; // 25 MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = safeName(file.name);
  const filepath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  const url = `/uploads/homework/${filename}`;
  return NextResponse.json({
    url,
    name: file.name,
    type: category,
  });
}
