import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";
import { normalizeAttachmentPayloadList } from "@/lib/attachment-url";
import { sendFeedbackNotification } from "@/lib/homework-reminders";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacher = await getTeacherSession();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!teacher.isSuperAdmin) {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT COUNT(*) AS ok
      FROM "HomeworkResponse" hr
      JOIN "Student" s ON s.id = hr.studentId
      WHERE hr.id = ${id} AND s.teacherId = ${teacher.id}
    `;
    if (Number(rows[0]?.ok ?? 0) === 0) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }
  }
  const body = await request.json();

  const attachmentsJson =
    body.teacherFeedbackAttachments !== undefined
      ? Array.isArray(body.teacherFeedbackAttachments) &&
        body.teacherFeedbackAttachments.every(
          (a: unknown) => a && typeof (a as { url?: string }).url === "string"
        )
        ? JSON.stringify(
            normalizeAttachmentPayloadList(
              body.teacherFeedbackAttachments as Array<{ url: string; name: string; type?: string }>
            )
          )
        : "[]"
      : undefined;

  const updated = await prisma.homeworkResponse.update({
    where: { id },
    data: {
      teacherFeedback:
        body.teacherFeedback !== undefined
          ? String(body.teacherFeedback)
          : undefined,
      ...(attachmentsJson !== undefined && {
        teacherFeedbackAttachments: attachmentsJson,
      }),
      feedbackAt: new Date(),
    },
  });

  // Fire-and-forget — don't block the response on email delivery
  const feedbackText =
    body.teacherFeedback !== undefined ? String(body.teacherFeedback) : "";
  if (feedbackText.trim()) {
    sendFeedbackNotification({ responseId: id, teacherFeedback: feedbackText }).catch(
      (e) => console.error("[feedback-notify] fire-and-forget error", e)
    );
  }

  return NextResponse.json(updated);
}
