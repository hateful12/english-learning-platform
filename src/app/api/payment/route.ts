import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";

export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (teacher) {
    const items = await prisma.paymentInfo.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(items);
  }
  const studentId = await getStudentId();
  if (studentId) {
    const forStudent = await prisma.paymentInfo.findFirst({
      where: { studentId },
      orderBy: { updatedAt: "desc" },
    });
    if (forStudent) {
      return NextResponse.json(forStudent);
    }
  }
  const item = await prisma.paymentInfo.findFirst({
    where: { studentId: null },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(item ?? null);
}

export async function POST(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { content, amount, studentId } = body;
  const item = await prisma.paymentInfo.create({
    data: {
      content: content ?? "",
      amount: amount ?? null,
      studentId: studentId && typeof studentId === "string" ? studentId : null,
    },
  });
  return NextResponse.json(item);
}

export async function PATCH(request: NextRequest) {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { id, content, amount, studentId } = body;
  if (!id) {
    return NextResponse.json({ error: "Id required" }, { status: 400 });
  }
  const item = await prisma.paymentInfo.update({
    where: { id },
    data: {
      content: content ?? undefined,
      amount: amount ?? undefined,
      studentId: studentId !== undefined ? (studentId && typeof studentId === "string" ? studentId : null) : undefined,
    },
  });
  return NextResponse.json(item);
}
