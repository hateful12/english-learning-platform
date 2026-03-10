import { NextRequest, NextResponse } from "next/server";
import { verifyTeacherPassword, setTeacherSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const teacherId = await verifyTeacherPassword(email, password);
  if (!teacherId) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await setTeacherSession(teacherId);
  return NextResponse.json({ success: true });
}
