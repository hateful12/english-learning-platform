import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";
import { normalizeAttachmentPayloadList } from "@/lib/attachment-url";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
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

  return NextResponse.json(updated);
}
