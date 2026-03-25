import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function POST(
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

    const { id: homeworkId } = await params;
    const { studentId, close } = (body as Record<string, unknown>) ?? {};

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }

    if (close) {
      const now = new Date().toISOString();
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "HomeworkStudentClose" (homeworkId, studentId, closedAt)
        VALUES (${homeworkId}, ${studentId}, ${now})
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM "HomeworkStudentClose"
        WHERE homeworkId = ${homeworkId} AND studentId = ${studentId}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/homework/[id]/student-close error:", err);
    return NextResponse.json({ error: "Failed to update close status" }, { status: 500 });
  }
}
