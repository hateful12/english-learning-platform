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
  const attachmentsJson =
    body.attachments !== undefined
      ? Array.isArray(body.attachments) && body.attachments.every((a: unknown) => a && typeof (a as { url?: string }).url === "string")
        ? JSON.stringify(body.attachments)
        : "[]"
      : undefined;
  const item = await prisma.homework.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description,
      ...(attachmentsJson !== undefined && { attachments: attachmentsJson }),
      studentId: body.studentId !== undefined ? (body.studentId && typeof body.studentId === "string" ? body.studentId : null) : undefined,
      groupId: body.groupId !== undefined ? (body.groupId && typeof body.groupId === "string" ? body.groupId : null) : undefined,
      ...(body.status === "active" || body.status === "closed" ? { status: body.status } : {}),
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
  await prisma.homework.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
