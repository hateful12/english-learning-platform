import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { safeResolvedHomeworkFilePath } from "@/lib/homework-upload-path";

export const runtime = "nodejs";

function contentTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".gz": "application/gzip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: raw } = await params;
  let filename = raw;
  try {
    filename = decodeURIComponent(raw);
  } catch {
    filename = raw;
  }
  const diskPath = safeResolvedHomeworkFilePath(filename);
  if (!diskPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const buf = await fs.readFile(diskPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentTypeForFilename(path.basename(diskPath)),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
