import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";
import { randomUUID } from "crypto";

type GroupStudentRow = {
  groupId: string;
  groupName: string;
  groupLessonPrice: number | null;
  groupCreatedAt: string;
  studentId: string | null;
  studentEmail: string | null;
  studentName: string | null;
};

function buildGroupList(rows: GroupStudentRow[]) {
  const map = new Map<string, { id: string; name: string; lessonPrice: number | null; createdAt: string; students: Array<{ id: string; email: string; name: string | null }> }>();
  for (const row of rows) {
    if (!map.has(row.groupId)) {
      map.set(row.groupId, {
        id: row.groupId,
        name: row.groupName,
        lessonPrice: row.groupLessonPrice,
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
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.$queryRaw<GroupStudentRow[]>`
      SELECT
        g.id           AS groupId,
        g.name         AS groupName,
        g.lessonPrice  AS groupLessonPrice,
        g.createdAt    AS groupCreatedAt,
        s.id           AS studentId,
        s.email        AS studentEmail,
        s.name         AS studentName
      FROM "Group" g
      LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
      LEFT JOIN "Student"      s  ON s.id = sg.studentId
      ORDER BY g.createdAt ASC
    `;

    return NextResponse.json(buildGroupList(rows));
  } catch (err) {
    console.error("GET /api/groups error:", err);
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, studentIds, lessonPrice } = (body as Record<string, unknown>) ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Group name required" }, { status: 400 });
    }

    const ids = Array.isArray(studentIds)
      ? (studentIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];

    const priceInKopecks =
      typeof lessonPrice === "number" && lessonPrice > 0
        ? Math.round(lessonPrice * 100)
        : null;

    const id = randomUUID().replace(/-/g, "");
    const now = new Date().toISOString();

    await prisma.$executeRaw`INSERT INTO "Group" (id, name, lessonPrice, createdAt) VALUES (${id}, ${name.trim()}, ${priceInKopecks}, ${now})`;

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
        g.createdAt    AS groupCreatedAt,
        s.id           AS studentId,
        s.email        AS studentEmail,
        s.name         AS studentName
      FROM "Group" g
      LEFT JOIN "StudentGroup" sg ON sg.groupId = g.id
      LEFT JOIN "Student"      s  ON s.id = sg.studentId
      WHERE g.id = ${id}
    `;

    const [group] = buildGroupList(rows);
    return NextResponse.json(group);
  } catch (err) {
    console.error("POST /api/groups error:", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
