import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
  }
  const invite = await prisma.invite.findUnique({
    where: { token },
  });
  if (!invite) {
    return NextResponse.json({ valid: false, error: "Invalid invite" });
  }
  if (invite.usedAt) {
    return NextResponse.json({ valid: false, error: "Invite already used" });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "Invite expired" });
  }
  return NextResponse.json({ valid: true, token: invite.token });
}
