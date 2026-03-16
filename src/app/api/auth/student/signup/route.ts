import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword, setStudentSession } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt silently truncates beyond 72 bytes

async function generatePaymentCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[randomInt(chars.length)];
    }
    const existing = await prisma.student.findUnique({ where: { paymentCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique payment code");
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { token, email, name, password } = body;
    if (!token || !email || !password || typeof token !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Token, email and password required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (password.length < PASSWORD_MIN) {
      return NextResponse.json({ error: `Password must be at least ${PASSWORD_MIN} characters` }, { status: 400 });
    }
    if (password.length > PASSWORD_MAX) {
      return NextResponse.json({ error: `Password must be at most ${PASSWORD_MAX} characters` }, { status: 400 });
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
    const paymentCode = await generatePaymentCode();
    const student = await prisma.student.create({
      data: {
        email: email.trim().toLowerCase(),
        name: typeof name === "string" ? name.trim() || null : null,
        passwordHash,
        paymentCode,
      },
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), studentId: student.id },
    });
    await setStudentSession(student.id);
    return NextResponse.json({ success: true, student: { id: student.id, email: student.email, name: student.name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[signup]", err);
    return NextResponse.json(
      { error: "Signup failed", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
