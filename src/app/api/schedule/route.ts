import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";

export async function GET() {
  const teacher = await isTeacherLoggedIn();

  if (teacher) {
    const lessons = await prisma.scheduledLesson.findMany({
      include: {
        student: { select: { id: true, email: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "asc" },
    });
    return NextResponse.json(lessons);
  }

  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json([], { status: 401 });

  // Find student's groups
  const studentGroups = await prisma.studentGroup.findMany({
    where: { studentId },
    select: { groupId: true },
  });
  const groupIds = studentGroups.map((sg) => sg.groupId);

  const lessons = await prisma.scheduledLesson.findMany({
    where: {
      OR: [
        { studentId },
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
      ],
    },
    include: {
      group: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(lessons);
}

export async function POST(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { title, startAt, durationMin, zoomUrl, notes, studentId, groupId } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!startAt) {
    return NextResponse.json({ error: "startAt is required" }, { status: 400 });
  }

  const lesson = await prisma.scheduledLesson.create({
    data: {
      title,
      startAt: new Date(startAt),
      durationMin: typeof durationMin === "number" ? durationMin : 60,
      zoomUrl: zoomUrl && typeof zoomUrl === "string" ? zoomUrl : null,
      notes: notes && typeof notes === "string" ? notes : null,
      studentId: studentId && typeof studentId === "string" ? studentId : null,
      groupId: groupId && typeof groupId === "string" ? groupId : null,
    },
    include: {
      student: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(lesson);
}
