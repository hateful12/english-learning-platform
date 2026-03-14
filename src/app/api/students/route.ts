import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function GET() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, paymentCode: true, lessonPrice: true, createdAt: true },
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

  const { id, lessonPrice } = (body as Record<string, unknown>) ?? {};
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  const priceInKopecks =
    typeof lessonPrice === "number" && lessonPrice > 0
      ? Math.round(lessonPrice * 100)
      : null;

  const updated = await prisma.student.update({
    where: { id },
    data: { lessonPrice: priceInKopecks },
    select: { id: true, email: true, name: true, paymentCode: true, lessonPrice: true, createdAt: true },
  });

  return NextResponse.json(updated);
}
