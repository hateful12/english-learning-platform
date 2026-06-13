import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession, teacherCanAccessStudent, TeacherSession } from "@/lib/auth";
import { normalizeAttachmentPayloadList } from "@/lib/attachment-url";

async function teacherCanAccessHomework(teacher: TeacherSession, homeworkId: string) {
  if (teacher.isSuperAdmin) return true;
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    SELECT COUNT(*) AS ok
    FROM "Homework" h
    LEFT JOIN "Student" s ON s.id = h.studentId
    LEFT JOIN "Group" g ON g.id = h.groupId
    WHERE h.id = ${homeworkId}
      AND (
        s.teacherId = ${teacher.id}
        OR g.teacherId = ${teacher.id}
        OR EXISTS (
          SELECT 1
          FROM "StudentGroup" sg
          JOIN "Student" member ON member.id = sg.studentId
          WHERE sg.groupId = h.groupId AND member.teacherId = ${teacher.id}
        )
      )
  `;
  return Number(rows[0]?.ok ?? 0) > 0;
}

async function teacherCanAccessGroup(teacher: TeacherSession, groupId: string) {
  if (teacher.isSuperAdmin) return true;
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    SELECT COUNT(*) AS ok
    FROM "Group" g
    WHERE g.id = ${groupId}
      AND (
        g.teacherId = ${teacher.id}
        OR EXISTS (
          SELECT 1
          FROM "StudentGroup" sg
          JOIN "Student" s ON s.id = sg.studentId
          WHERE sg.groupId = g.id AND s.teacherId = ${teacher.id}
        )
      )
  `;
  return Number(rows[0]?.ok ?? 0) > 0;
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacher = await getTeacherSession();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await teacherCanAccessHomework(teacher, id))) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }
  const body = await _request.json();
  if (!teacher.isSuperAdmin && body.studentId !== undefined && !body.studentId && !body.groupId) {
    return NextResponse.json({ error: "Choose a student or group" }, { status: 400 });
  }
  if (body.studentId && typeof body.studentId === "string" && !(await teacherCanAccessStudent(teacher, body.studentId))) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (body.groupId && typeof body.groupId === "string" && !(await teacherCanAccessGroup(teacher, body.groupId))) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const attachmentsJson =
    body.attachments !== undefined
      ? Array.isArray(body.attachments) && body.attachments.every((a: unknown) => a && typeof (a as { url?: string }).url === "string")
        ? JSON.stringify(
            normalizeAttachmentPayloadList(body.attachments as Array<{ url: string; name: string; type?: string }>)
          )
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

  // groupId on Homework: keep in sync with studentId (mutual exclusivity)
  if (body.groupId !== undefined) {
    const newGroupId = body.groupId && typeof body.groupId === "string" ? body.groupId : null;
    if (newGroupId) {
      await prisma.$executeRaw`UPDATE "Homework" SET groupId = ${newGroupId}, studentId = NULL WHERE id = ${id}`;
    } else {
      await prisma.$executeRaw`UPDATE "Homework" SET groupId = NULL WHERE id = ${id}`;
    }
  }

  if (
    body.studentId !== undefined &&
    body.studentId &&
    typeof body.studentId === "string"
  ) {
    await prisma.$executeRaw`UPDATE "Homework" SET groupId = NULL WHERE id = ${id}`;
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacher = await getTeacherSession();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await teacherCanAccessHomework(teacher, id))) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }
  await prisma.homework.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
