import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  const lesson = await prisma.scheduledLesson.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.startAt !== undefined && { startAt: new Date(body.startAt) }),
      ...(body.durationMin !== undefined && { durationMin: body.durationMin }),
      ...(body.zoomUrl !== undefined && {
        zoomUrl: body.zoomUrl && typeof body.zoomUrl === "string" ? body.zoomUrl : null,
      }),
      ...(body.notes !== undefined && {
        notes: body.notes && typeof body.notes === "string" ? body.notes : null,
      }),
      ...(body.studentId !== undefined && {
        studentId: body.studentId && typeof body.studentId === "string" ? body.studentId : null,
      }),
      ...(body.groupId !== undefined && {
        groupId: body.groupId && typeof body.groupId === "string" ? body.groupId : null,
      }),
    },
    include: {
      student: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(lesson);
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
  await prisma.scheduledLesson.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
