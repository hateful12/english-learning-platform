import { NextRequest, NextResponse } from "next/server";
import { verifyTeacherPassword, setTeacherSession } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, password } = (body as Record<string, unknown>) ?? {};
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  const teacherId = await verifyTeacherPassword(email, password);
  if (!teacherId) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await setTeacherSession(teacherId);
  return NextResponse.json({ success: true });
}
