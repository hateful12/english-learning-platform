import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStudentPassword, setStudentSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
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
