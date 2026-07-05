import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession, teacherCanAccessStudent } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/teacher/reset-stat
// action "overdue"  → mark all past unpaid lessons as paid (write-off the debt)
// action "balance"  → mark all future paid lessons as unpaid (remove prepaid/наперед)
export async function POST(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!teacher.isSuperAdmin) {
    return NextResponse.json({ error: "Super-admin only" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { studentId, action } = (body as Record<string, unknown>) ?? {};
  if (typeof studentId !== "string") return NextResponse.json({ error: "studentId required" }, { status: 400 });
  if (action !== "overdue" && action !== "balance") {
    return NextResponse.json({ error: "action must be 'overdue' or 'balance'" }, { status: 400 });
  }

  if (!(await teacherCanAccessStudent(teacher, studentId))) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  if (action === "overdue") {
    // Write off debt: mark all past unpaid individual lessons as paid
    await prisma.$executeRaw`
      UPDATE "ScheduledLesson"
      SET isPaid = 1
      WHERE studentId = ${studentId} AND isPaid = 0 AND startAt < ${nowIso}
    `;
    // Also mark past unpaid group lesson payments for this student
    await prisma.$executeRaw`
      UPDATE "GroupLessonPayment"
      SET isPaid = 1
      WHERE studentId = ${studentId} AND isPaid = 0
        AND EXISTS (
          SELECT 1 FROM "ScheduledLesson" sl
          WHERE sl.id = "GroupLessonPayment".lessonId AND sl.startAt < ${nowIso}
        )
    `;
    return NextResponse.json({ ok: true, action: "overdue" });
  }

  // action === "balance": remove prepaid/наперед status from future paid lessons
  await prisma.$executeRaw`
    UPDATE "ScheduledLesson"
    SET isPaid = 0, paymentId = NULL
    WHERE studentId = ${studentId} AND isPaid = 1 AND startAt > ${nowIso}
  `;
  // Also remove future paid group lesson payments for this student
  await prisma.$executeRaw`
    UPDATE "GroupLessonPayment"
    SET isPaid = 0, paymentId = NULL
    WHERE studentId = ${studentId} AND isPaid = 1
      AND EXISTS (
        SELECT 1 FROM "ScheduledLesson" sl
        WHERE sl.id = "GroupLessonPayment".lessonId AND sl.startAt > ${nowIso}
      )
  `;
  return NextResponse.json({ ok: true, action: "balance" });
}
