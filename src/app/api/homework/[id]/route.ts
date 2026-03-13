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
      ...(body.status === "active" || body.status === "closed" ? { status: body.status } : {}),
    },
  });

  // Handle groupId via raw SQL since old Prisma client doesn't know this field
  if (body.groupId !== undefined) {
    const newGroupId = body.groupId && typeof body.groupId === "string" ? body.groupId : null;
    if (newGroupId) {
      await prisma.$executeRaw`UPDATE "Homework" SET groupId = ${newGroupId} WHERE id = ${id}`;
    } else {
      await prisma.$executeRaw`UPDATE "Homework" SET groupId = NULL WHERE id = ${id}`;
    }
  }

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
