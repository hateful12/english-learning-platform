import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";

export async function GET() {
  try {
    const teacher = await isTeacherLoggedIn();
    const studentId = teacher ? null : await getStudentId();
    const items = await prisma.homework.findMany({
      where: teacher ? undefined : studentId ? { OR: [{ studentId: null }, { studentId }] } : { studentId: null },
      orderBy: { createdAt: "desc" },
      include: {
        ...(teacher
          ? { responses: { include: { student: { select: { id: true, email: true, name: true } } } } }
          : studentId
            ? { responses: { where: { studentId } } }
            : {}),
      },
    });
    type Row = (typeof items)[number] & {
      responses?: Array<{
        id: string;
        response: string;
        submittedAt: Date;
        teacherFeedback?: string | null;
        teacherFeedbackAttachments?: string;
        feedbackAt?: Date | null;
        student?: { id: string; email: string; name: string | null };
      }>;
    };
    const serialized = (items as Row[]).map((item) => {
      const { responses, ...rest } = item;
      return {
        ...rest,
        responses:
          responses && Array.isArray(responses)
            ? responses.map((r) => ({
                id: r.id,
                response: r.response,
                submittedAt: r.submittedAt,
                teacherFeedback: r.teacherFeedback ?? null,
                teacherFeedbackAttachments: r.teacherFeedbackAttachments ?? "[]",
                feedbackAt: r.feedbackAt ?? null,
                ...(r.student ? { student: r.student } : {}),
              }))
            : [],
      };
    });
    return NextResponse.json(serialized);
  } catch (err) {
    console.error("GET /api/homework error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load homework", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { title, description, studentId, attachments } = (body as Record<string, unknown>) ?? {};
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    const attachmentsJson =
      Array.isArray(attachments) && attachments.every((a: unknown) => a && typeof (a as { url?: string }).url === "string")
        ? JSON.stringify(attachments)
        : "[]";
    const item = await prisma.homework.create({
      data: {
        title,
        description: (description as string) ?? "",
        attachments: attachmentsJson,
        studentId: studentId && typeof studentId === "string" ? studentId : null,
      },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error("POST /api/homework error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to create homework", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
