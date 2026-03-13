import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

type GroupStudentRow = {
  groupId: string;
  groupName: string;
  groupCreatedAt: string;
  studentId: string | null;
  studentEmail: string | null;
  studentName: string | null;
};

async function fetchGroup(id: string) {
  const rows = await prisma.$queryRaw<GroupStudentRow[]>`
    SELECT
      g.id      AS groupId,
      g.name    AS groupName,
      g.createdAt AS groupCreatedAt,
      s.id      AS studentId,
      s.email   AS studentEmail,
      s.name    AS studentName
    FROM "Group" g
    LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
    LEFT JOIN "Student"      s  ON s.id = sg.studentId
    WHERE g.id = ${id}
  `;
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.groupId,
    name: first.groupName,
    createdAt: first.groupCreatedAt,
    students: rows
      .filter((r) => r.studentId)
      .map((r) => ({ id: r.studentId!, email: r.studentEmail!, name: r.studentName })),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id } = await params;
    const { name, studentIds } = (body as Record<string, unknown>) ?? {};

    if (name && typeof name === "string" && name.trim()) {
      await prisma.$executeRaw`UPDATE "Group" SET name = ${name.trim()} WHERE id = ${id}`;
    }

    if (Array.isArray(studentIds)) {
      const ids = (studentIds as unknown[]).filter((sid): sid is string => typeof sid === "string");
      await prisma.$executeRaw`DELETE FROM "StudentGroup" WHERE groupId = ${id}`;
      for (const studentId of ids) {
        await prisma.$executeRaw`
          INSERT OR IGNORE INTO "StudentGroup" (studentId, groupId) VALUES (${studentId}, ${id})
        `;
      }
    }

    const group = await fetchGroup(id);
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (err) {
    console.error("PATCH /api/groups/[id] error:", err);
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.$executeRaw`UPDATE "Homework" SET groupId = NULL WHERE groupId = ${id}`;
    await prisma.$executeRaw`DELETE FROM "StudentGroup" WHERE groupId = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Group" WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/groups/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
