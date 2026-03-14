import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";
import { randomUUID } from "crypto";

type LessonRow = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  zoomUrl: string | null;
  notes: string | null;
  studentId: string | null;
  groupId: string | null;
  isPaid: number | boolean;
  createdAt: string;
  s_id: string | null;
  s_email: string | null;
  s_name: string | null;
  g_id: string | null;
  g_name: string | null;
};

function formatLesson(row: LessonRow, isTeacher: boolean) {
  const isPaid = Boolean(row.isPaid);
  return {
    id: row.id,
    title: row.title,
    startAt: row.startAt,
    durationMin: row.durationMin,
    // Hide zoomUrl from students until lesson is paid
    zoomUrl: isTeacher || isPaid ? row.zoomUrl : null,
    notes: row.notes,
    studentId: row.studentId,
    groupId: row.groupId,
    isPaid,
    createdAt: row.createdAt,
    student: row.s_id ? { id: row.s_id, email: row.s_email, name: row.s_name } : null,
    group: row.g_id ? { id: row.g_id, name: row.g_name } : null,
  };
}

export async function GET() {
  try {
    const teacher = await isTeacherLoggedIn();

    if (teacher) {
      const rows = await prisma.$queryRaw<LessonRow[]>`
        SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          s.id    AS s_id,
          s.email AS s_email,
          s.name  AS s_name,
          g.id    AS g_id,
          g.name  AS g_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Student" s ON s.id = sl.studentId
        LEFT JOIN "Group"   g ON g.id = sl.groupId
        ORDER BY sl.startAt ASC
      `;
      return NextResponse.json(rows.map((r) => formatLesson(r, true)));
    }

    const studentId = await getStudentId();
    if (!studentId) return NextResponse.json([], { status: 401 });

    const groupRows = await prisma.$queryRaw<{ groupId: string }[]>`
      SELECT groupId FROM "StudentGroup" WHERE studentId = ${studentId}
    `;
    const groupIds = groupRows.map((r) => r.groupId);

    let rows: LessonRow[];
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => "?").join(",");
      rows = await prisma.$queryRawUnsafe<LessonRow[]>(
        `SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          g.id   AS g_id,
          g.name AS g_name,
          NULL AS s_id, NULL AS s_email, NULL AS s_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Group" g ON g.id = sl.groupId
        WHERE sl.studentId = ? OR sl.groupId IN (${placeholders})
        ORDER BY sl.startAt ASC`,
        studentId,
        ...groupIds
      );
    } else {
      rows = await prisma.$queryRaw<LessonRow[]>`
        SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          g.id   AS g_id,
          g.name AS g_name,
          NULL AS s_id, NULL AS s_email, NULL AS s_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Group" g ON g.id = sl.groupId
        WHERE sl.studentId = ${studentId}
        ORDER BY sl.startAt ASC
      `;
    }

    return NextResponse.json(rows.map((r) => formatLesson(r, false)));
  } catch (err) {
    console.error("GET /api/schedule error:", err);
    return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      title, startAt, durationMin, zoomUrl, notes, studentId, groupId,
      repeatDays, repeatCount,
    } = (body as Record<string, unknown>) ?? {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!startAt) {
      return NextResponse.json({ error: "startAt is required" }, { status: 400 });
    }

    const dur = typeof durationMin === "number" ? durationMin : 60;
    const zoom = zoomUrl && typeof zoomUrl === "string" ? zoomUrl.trim() || null : null;
    const notesVal = notes && typeof notes === "string" ? notes.trim() || null : null;
    const sId = studentId && typeof studentId === "string" ? studentId : null;
    const gId = groupId && typeof groupId === "string" ? groupId : null;

    const baseStart = new Date(startAt as string);
    const occurrences = typeof repeatCount === "number" && repeatCount > 1 ? repeatCount : 1;
    const intervalDays = typeof repeatDays === "number" && repeatDays > 0 ? repeatDays : 0;

    const created: ReturnType<typeof formatLesson>[] = [];

    for (let i = 0; i < occurrences; i++) {
      const start = new Date(baseStart.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
      const id = randomUUID().replace(/-/g, "");
      const now = new Date().toISOString();
      const startISO = start.toISOString();

      await prisma.$executeRaw`
        INSERT INTO "ScheduledLesson" (id, title, startAt, durationMin, zoomUrl, notes, studentId, groupId, isPaid, createdAt)
        VALUES (${id}, ${title.trim()}, ${startISO}, ${dur}, ${zoom}, ${notesVal}, ${sId}, ${gId}, 0, ${now})
      `;

      const rows = await prisma.$queryRaw<LessonRow[]>`
        SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          s.id    AS s_id,
          s.email AS s_email,
          s.name  AS s_name,
          g.id    AS g_id,
          g.name  AS g_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Student" s ON s.id = sl.studentId
        LEFT JOIN "Group"   g ON g.id = sl.groupId
        WHERE sl.id = ${id}
      `;
      if (rows[0]) created.push(formatLesson(rows[0], true));
    }

    return NextResponse.json(created.length === 1 ? created[0] : created);
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
