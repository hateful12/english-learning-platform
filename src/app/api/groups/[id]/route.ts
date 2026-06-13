import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession, TeacherSession } from "@/lib/auth";

type GroupStudentRow = {
  groupId: string;
  groupName: string;
  groupLessonPrice: number | null;
  groupTeacherId: string | null;
  groupCreatedAt: string;
  studentId: string | null;
  studentEmail: string | null;
  studentName: string | null;
};

async function fetchGroup(id: string, teacher: TeacherSession) {
  const rows = teacher.isSuperAdmin
    ? await prisma.$queryRaw<GroupStudentRow[]>`
        SELECT
          g.id           AS groupId,
          g.name         AS groupName,
          g.lessonPrice  AS groupLessonPrice,
          g.teacherId    AS groupTeacherId,
          g.createdAt    AS groupCreatedAt,
          s.id           AS studentId,
          s.email        AS studentEmail,
          s.name         AS studentName
        FROM "Group" g
        LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
        LEFT JOIN "Student"      s  ON s.id = sg.studentId
        WHERE g.id = ${id}
      `
    : await prisma.$queryRaw<GroupStudentRow[]>`
        SELECT
          g.id           AS groupId,
          g.name         AS groupName,
          NULL           AS groupLessonPrice,
          g.teacherId    AS groupTeacherId,
          g.createdAt    AS groupCreatedAt,
          s.id           AS studentId,
          s.email        AS studentEmail,
          s.name         AS studentName
        FROM "Group" g
        LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
        LEFT JOIN "Student"      s  ON s.id = sg.studentId AND s.teacherId = ${teacher.id}
        WHERE g.id = ${id}
          AND (
            g.teacherId = ${teacher.id}
            OR EXISTS (
              SELECT 1
              FROM "StudentGroup" sg2
              JOIN "Student" s2 ON s2.id = sg2.studentId
              WHERE sg2.groupId = g.id AND s2.teacherId = ${teacher.id}
            )
          )
      `;
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.groupId,
    name: first.groupName,
    lessonPrice: teacher.isSuperAdmin ? first.groupLessonPrice : null,
    teacherId: first.groupTeacherId,
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
    const teacher = await getTeacherSession();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id } = await params;
    const { name, studentIds, lessonPrice, teacherId } = (body as Record<string, unknown>) ?? {};

    const current = await fetchGroup(id, teacher);
    if (!current) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (name && typeof name === "string" && name.trim()) {
      await prisma.$executeRaw`UPDATE "Group" SET name = ${name.trim()} WHERE id = ${id}`;
    }

    if (lessonPrice !== undefined) {
      if (!teacher.isSuperAdmin) {
        return NextResponse.json({ error: "Only the super-admin can edit lesson prices" }, { status: 403 });
      }
      const priceInKopecks =
        typeof lessonPrice === "number" && lessonPrice > 0
          ? Math.round(lessonPrice * 100)
          : null;
      await prisma.$executeRaw`UPDATE "Group" SET lessonPrice = ${priceInKopecks} WHERE id = ${id}`;
    }

    if (teacherId !== undefined) {
      if (!teacher.isSuperAdmin) {
        return NextResponse.json({ error: "Only the super-admin can change the group teacher" }, { status: 403 });
      }
      const newTeacherId = typeof teacherId === "string" && teacherId ? teacherId : null;
      await prisma.$executeRaw`UPDATE "Group" SET teacherId = ${newTeacherId} WHERE id = ${id}`;
    }

    if (Array.isArray(studentIds)) {
      let ids = (studentIds as unknown[]).filter((sid): sid is string => typeof sid === "string");
      if (!teacher.isSuperAdmin) {
        const allowed = await prisma.student.findMany({
          where: { id: { in: ids }, teacherId: teacher.id },
          select: { id: true },
        });
        ids = allowed.map((s) => s.id);
        await prisma.$executeRaw`
          DELETE FROM "StudentGroup"
          WHERE groupId = ${id}
            AND studentId IN (SELECT id FROM "Student" WHERE teacherId = ${teacher.id})
        `;
      } else {
        await prisma.$executeRaw`DELETE FROM "StudentGroup" WHERE groupId = ${id}`;
      }
      for (const studentId of ids) {
        await prisma.$executeRaw`
          INSERT OR IGNORE INTO "StudentGroup" (studentId, groupId) VALUES (${studentId}, ${id})
        `;
      }
    }

    const group = await fetchGroup(id, teacher);
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
    const teacher = await getTeacherSession();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!teacher.isSuperAdmin) {
      const rows = await prisma.$queryRaw<Array<{ teacherId: string | null; externalStudents: number }>>`
        SELECT
          g.teacherId AS teacherId,
          COUNT(CASE WHEN s.id IS NOT NULL AND (s.teacherId IS NULL OR s.teacherId != ${teacher.id}) THEN 1 END) AS externalStudents
        FROM "Group" g
        LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
        LEFT JOIN "Student" s ON s.id = sg.studentId
        WHERE g.id = ${id}
        GROUP BY g.id
      `;
      const row = rows[0];
      if (!row || row.teacherId !== teacher.id || Number(row.externalStudents) > 0) {
        return NextResponse.json({ error: "Only the super-admin can delete this group" }, { status: 403 });
      }
    }
    await prisma.$executeRaw`UPDATE "Homework" SET groupId = NULL WHERE groupId = ${id}`;
    await prisma.$executeRaw`DELETE FROM "StudentGroup" WHERE groupId = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Group" WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/groups/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
