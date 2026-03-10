import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

/** Student submits or updates their response for a homework assignment. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: homeworkId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const response = (body as { response?: unknown })?.response;
  if (response !== undefined && typeof response !== "string") {
    return NextResponse.json({ error: "response must be a string" }, { status: 400 });
  }
  const text = (response ?? "").trim();

  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: { id: true, studentId: true },
  });
  if (!homework) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }
  if (homework.studentId != null && homework.studentId !== studentId) {
    return NextResponse.json({ error: "This homework is not assigned to you" }, { status: 403 });
  }

  const updated = await prisma.homeworkResponse.upsert({
    where: {
      homeworkId_studentId: { homeworkId, studentId },
    },
    create: { homeworkId, studentId, response: text },
    update: { response: text },
  });
  return NextResponse.json(updated);
}
