import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, isTeacherLoggedIn } from "@/lib/auth";

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt silently truncates beyond 72 bytes

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

  const { id, lessonPrice, level, temporaryPassword } = (body as Record<string, unknown>) ?? {};
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

  if (temporaryPassword !== undefined) {
    if (typeof temporaryPassword !== "string") {
      return NextResponse.json({ error: "Invalid temporary password" }, { status: 400 });
    }
    const pwd = temporaryPassword;
    if (pwd.length < PASSWORD_MIN) {
      return NextResponse.json(
        { error: `Temporary password must be at least ${PASSWORD_MIN} characters` },
        { status: 400 }
      );
    }
    if (pwd.length > PASSWORD_MAX) {
      return NextResponse.json(
        { error: `Temporary password must be at most ${PASSWORD_MAX} characters` },
        { status: 400 }
      );
    }
    updateData.passwordHash = await hashPassword(pwd);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const updated = await prisma.student.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, paymentCode: true, lessonPrice: true, level: true, createdAt: true },
  });

  return NextResponse.json(updated);
}
