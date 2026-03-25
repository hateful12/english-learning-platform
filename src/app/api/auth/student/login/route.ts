import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStudentPassword, setStudentSession } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, password } = (body as Record<string, unknown>) ?? {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  const student = await prisma.student.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!student) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await verifyStudentPassword(password, student.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await setStudentSession(student.id);
  return NextResponse.json({ success: true, student: { id: student.id, email: student.email, name: student.name } });
}
