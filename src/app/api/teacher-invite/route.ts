import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAppUrl(request: NextRequest): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function GET() {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await prisma.teacherInvite.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      email: true,
      usedAt: true,
      createdAt: true,
      createdTeacherId: true,
    },
  });

  return NextResponse.json(invites);
}

export async function POST(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (rawEmail) {
    const existingTeacher = await prisma.teacher.findUnique({ where: { email: rawEmail } });
    if (existingTeacher) {
      return NextResponse.json({ error: "A teacher with this email already exists" }, { status: 400 });
    }
  }

  const token = crypto.randomBytes(24).toString("hex");
  const invite = await prisma.teacherInvite.create({
    data: {
      token,
      email: rawEmail || null,
      createdByTeacherId: teacher.id,
    },
  });

  const baseUrl = getAppUrl(request);
  const link = `${baseUrl}/teacher/join?token=${invite.token}`;

  return NextResponse.json({
    invite: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      usedAt: invite.usedAt,
      createdAt: invite.createdAt,
    },
    link,
  });
}
