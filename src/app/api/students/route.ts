import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function GET() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, paymentCode: true, lessonPrice: true, level: true, createdAt: true },
  });
  return NextResponse.json(students);
}

export async function PATCH(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, lessonPrice, level } = (body as Record<string, unknown>) ?? {};
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  const updateData: Record<string, unknown> = {};

  if (lessonPrice !== undefined) {
    updateData.lessonPrice =
      typeof lessonPrice === "number" && lessonPrice > 0
        ? Math.round(lessonPrice * 100)
        : null;
  }

  if (level !== undefined) {
    if (level === null || level === "") {
      updateData.level = null;
    } else if (typeof level === "string" && VALID_LEVELS.includes(level)) {
      updateData.level = level;
    } else {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
  }

  const updated = await prisma.student.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, paymentCode: true, lessonPrice: true, level: true, createdAt: true },
  });

  return NextResponse.json(updated);
}
