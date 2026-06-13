import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";
import { notifyHomeworkById } from "@/lib/homework-reminders";

export const runtime = "nodejs";

/** Teacher: resend homework notification emails immediately (same content as “new homework” mail). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherSession();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!teacher.isSuperAdmin) {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT COUNT(*) AS ok
      FROM "Homework" h
      LEFT JOIN "Student" s ON s.id = h.studentId
      LEFT JOIN "Group" g ON g.id = h.groupId
      WHERE h.id = ${id}
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
    if (Number(rows[0]?.ok ?? 0) === 0) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }
  }
  const result = await notifyHomeworkById(id);

  if (!result.ok) {
    const status = result.error === "Homework not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    recipientCount: result.recipientCount,
    sent: result.sent,
    failed: result.failed,
    ...(result.failed > 0 && result.firstError ? { firstError: result.firstError } : {}),
  });
}
