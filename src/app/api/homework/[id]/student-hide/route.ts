import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: homeworkId } = await params;
    const now = new Date().toISOString();

    await prisma.$executeRaw`
      INSERT OR IGNORE INTO "HomeworkStudentHide" (homeworkId, studentId, hiddenAt)
      VALUES (${homeworkId}, ${studentId}, ${now})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/homework/[id]/student-hide error:", err);
    return NextResponse.json({ error: "Failed to hide homework" }, { status: 500 });
  }
}
