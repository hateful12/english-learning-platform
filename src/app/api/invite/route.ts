import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";
import crypto from "crypto";

function getAppUrl(request: NextRequest): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function GET() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
  return NextResponse.json(invites);
}

export async function POST(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const invite = await prisma.invite.create({
    data: { token },
  });
  const baseUrl = getAppUrl(request);
  const link = `${baseUrl}/join?token=${invite.token}`;
  return NextResponse.json({ invite: { id: invite.id, token: invite.token, usedAt: invite.usedAt, createdAt: invite.createdAt }, link });
}
