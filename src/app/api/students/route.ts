import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function GET() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return NextResponse.json(students);
}
