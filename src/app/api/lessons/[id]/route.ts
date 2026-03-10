import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await _request.json();
  const item = await prisma.lessonLink.update({
    where: { id },
    data: {
      title: body.title,
      url: body.url,
      studentId: body.studentId !== undefined ? (body.studentId && typeof body.studentId === "string" ? body.studentId : null) : undefined,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.lessonLink.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
