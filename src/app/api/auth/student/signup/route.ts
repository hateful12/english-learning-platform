import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setStudentSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, email, name, password } = body;
  if (!token || !email || !password || typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Token, email and password required" }, { status: 400 });
  }
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt) {
    return NextResponse.json({ error: "Invalid or already used invite" }, { status: 400 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }
  const existing = await prisma.student.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  const student = await prisma.student.create({
    data: {
      email: email.trim().toLowerCase(),
      name: typeof name === "string" ? name.trim() || null : null,
      passwordHash,
    },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });
  await setStudentSession(student.id);
  return NextResponse.json({ success: true, student: { id: student.id, email: student.email, name: student.name } });
}
