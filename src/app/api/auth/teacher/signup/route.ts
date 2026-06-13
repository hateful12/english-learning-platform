import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setTeacherSession } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, email, password } = body;
  if (
    typeof token !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json({ error: "Token, email and password required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN} characters` }, { status: 400 });
  }
  if (password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: `Password must be at most ${PASSWORD_MAX} characters` }, { status: 400 });
  }

  const invite = await prisma.teacherInvite.findUnique({ where: { token } });
  if (!invite || invite.usedAt) {
    return NextResponse.json({ error: "Invalid or already used invite" }, { status: 400 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }
  if (invite.email && invite.email.toLowerCase() !== normalizedEmail) {
    return NextResponse.json({ error: "Use the email address this invite was created for" }, { status: 400 });
  }

  const existing = await prisma.teacher.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: "teacher",
    },
  });

  await prisma.teacherInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), createdTeacherId: teacher.id },
  });

  await setTeacherSession(teacher.id);
  return NextResponse.json({
    success: true,
    teacher: { id: teacher.id, email: teacher.email, role: teacher.role },
  });
}
