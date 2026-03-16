import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";
import crypto from "crypto";

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

export async function POST() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const invite = await prisma.invite.create({
    data: { token },
  });
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${baseUrl}/join?token=${invite.token}`;
  return NextResponse.json({ invite: { id: invite.id, token: invite.token, usedAt: invite.usedAt, createdAt: invite.createdAt }, link });
}
