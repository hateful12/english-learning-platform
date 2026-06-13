import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";
import { randomUUID } from "crypto";

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

function buildGroupList(rows: GroupStudentRow[], canManagePayments: boolean) {
  const map = new Map<string, { id: string; name: string; lessonPrice: number | null; teacherId: string | null; createdAt: string; students: Array<{ id: string; email: string; name: string | null }> }>();
  for (const row of rows) {
    if (!map.has(row.groupId)) {
      map.set(row.groupId, {
        id: row.groupId,
        name: row.groupName,
        lessonPrice: canManagePayments ? row.groupLessonPrice : null,
        teacherId: row.groupTeacherId,
        createdAt: row.groupCreatedAt,
        students: [],
      });
    }
    if (row.studentId) {
      map.get(row.groupId)!.students.push({ id: row.studentId, email: row.studentEmail!, name: row.studentName });
    }
  }
  return Array.from(map.values());
}

export async function GET() {
  try {
    const teacher = await getTeacherSession();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
          ORDER BY g.createdAt ASC
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
          WHERE g.teacherId = ${teacher.id}
             OR EXISTS (
               SELECT 1
               FROM "StudentGroup" sg2
               JOIN "Student" s2 ON s2.id = sg2.studentId
               WHERE sg2.groupId = g.id AND s2.teacherId = ${teacher.id}
             )
          ORDER BY g.createdAt ASC
        `;

    return NextResponse.json(buildGroupList(rows, teacher.isSuperAdmin));
  } catch (err) {
    console.error("GET /api/groups error:", err);
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await getTeacherSession();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, studentIds, lessonPrice, teacherId } = (body as Record<string, unknown>) ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Group name required" }, { status: 400 });
    }

    let ids = Array.isArray(studentIds)
      ? (studentIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];

    if (!teacher.isSuperAdmin && ids.length > 0) {
      const allowed = await prisma.student.findMany({
        where: { id: { in: ids }, teacherId: teacher.id },
        select: { id: true },
      });
      ids = allowed.map((s) => s.id);
    }

    const priceInKopecks =
      teacher.isSuperAdmin && typeof lessonPrice === "number" && lessonPrice > 0
        ? Math.round(lessonPrice * 100)
        : null;

    const assignedTeacherId =
      teacher.isSuperAdmin && typeof teacherId === "string" && teacherId
        ? teacherId
        : teacher.id;

    const id = randomUUID().replace(/-/g, "");
    const now = new Date().toISOString();

    await prisma.$executeRaw`
      INSERT INTO "Group" (id, name, lessonPrice, teacherId, createdAt)
      VALUES (${id}, ${name.trim()}, ${priceInKopecks}, ${assignedTeacherId}, ${now})
    `;

    for (const studentId of ids) {
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "StudentGroup" (studentId, groupId) VALUES (${studentId}, ${id})
      `;
    }

    const rows = await prisma.$queryRaw<GroupStudentRow[]>`
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
    `;

    const [group] = buildGroupList(rows, teacher.isSuperAdmin);
    return NextResponse.json(group);
  } catch (err) {
    console.error("POST /api/groups error:", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
