import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";

export async function GET() {
  const teacher = await isTeacherLoggedIn();
  const studentId = teacher ? null : await getStudentId();
  const items = await prisma.miroLink.findMany({
    where: teacher ? undefined : studentId ? { OR: [{ studentId: null }, { studentId }] } : { studentId: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { title, url, studentId } = body;
  if (!title || !url || typeof title !== "string" || typeof url !== "string") {
    return NextResponse.json({ error: "Title and url required" }, { status: 400 });
  }
  const item = await prisma.miroLink.create({
    data: {
      title,
      url,
      studentId: studentId && typeof studentId === "string" ? studentId : null,
    },
  });
  return NextResponse.json(item);
}
