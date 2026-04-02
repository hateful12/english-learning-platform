import { NextRequest, NextResponse } from "next/server";
import { isTeacherLoggedIn } from "@/lib/auth";
import { notifyHomeworkById } from "@/lib/homework-reminders";

export const runtime = "nodejs";

/** Teacher: resend homework notification emails immediately (same content as “new homework” mail). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await notifyHomeworkById(id);

  if (!result.ok) {
    const status = result.error === "Homework not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    recipientCount: result.recipientCount,
    sent: result.sent,
    failed: result.failed,
  });
}
