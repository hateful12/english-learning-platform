import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

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

function formatLesson(row: LessonRow) {
  return {
    id: row.id,
    title: row.title,
    startAt: row.startAt,
    durationMin: row.durationMin,
    zoomUrl: row.zoomUrl,
    notes: row.notes,
    studentId: row.studentId,
    groupId: row.groupId,
    isPaid: Boolean(row.isPaid),
    createdAt: row.createdAt,
    student: row.s_id ? { id: row.s_id, email: row.s_email, name: row.s_name } : null,
    group: row.g_id ? { id: row.g_id, name: row.g_name } : null,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const b = (body as Record<string, unknown>) ?? {};

    // Build update dynamically — only update provided fields
    const updates: string[] = [];
    const args: unknown[] = [];

    if (b.title !== undefined) {
      updates.push(`title = ?`);
      args.push(String(b.title).trim());
    }
    if (b.startAt !== undefined) {
      updates.push(`startAt = ?`);
      args.push(new Date(b.startAt as string).toISOString());
    }
    if (b.durationMin !== undefined) {
      updates.push(`durationMin = ?`);
      args.push(Number(b.durationMin));
    }
    if (b.zoomUrl !== undefined) {
      updates.push(`zoomUrl = ?`);
      args.push(b.zoomUrl && typeof b.zoomUrl === "string" ? b.zoomUrl.trim() || null : null);
    }
    if (b.notes !== undefined) {
      updates.push(`notes = ?`);
      args.push(b.notes && typeof b.notes === "string" ? b.notes.trim() || null : null);
    }
    if (b.studentId !== undefined) {
      updates.push(`studentId = ?`);
      args.push(b.studentId && typeof b.studentId === "string" ? b.studentId : null);
    }
    if (b.groupId !== undefined) {
      updates.push(`groupId = ?`);
      args.push(b.groupId && typeof b.groupId === "string" ? b.groupId : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    args.push(id);
    await prisma.$executeRawUnsafe(
      `UPDATE "ScheduledLesson" SET ${updates.join(", ")} WHERE id = ?`,
      ...args
    );

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

    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(formatLesson(rows[0]));
  } catch (err) {
    console.error("PATCH /api/schedule/[id] error:", err);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await prisma.$executeRaw`DELETE FROM "ScheduledLesson" WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/schedule/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
