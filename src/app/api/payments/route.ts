import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await prisma.payment.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      student: { select: { id: true, name: true, email: true } },
      lesson: { select: { id: true, title: true, startAt: true } },
    },
  });

  return NextResponse.json(payments);
}

export async function PATCH(request: NextRequest) {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, lessonId, studentId } = (body as Record<string, unknown>) ?? {};

  // Manually mark a specific lesson as paid
  if (action === "markPaid" && typeof lessonId === "string") {
    const lesson = await prisma.scheduledLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    // Check if a payment already linked to this lesson
    const existingPayment = await prisma.payment.findUnique({ where: { lessonId } });
    if (!existingPayment) {
      // Create a manual payment record
      const sId = typeof studentId === "string" ? studentId : lesson.studentId;
      if (!sId) {
        return NextResponse.json({ error: "No student associated with this lesson" }, { status: 400 });
      }
      await prisma.payment.create({
        data: {
          studentId: sId,
          lessonId,
          monoId: `manual_${lessonId}_${Date.now()}`,
          amount: 0,
          comment: "Manually marked as paid by teacher",
          receivedAt: new Date(),
        },
      });
    }

    await prisma.scheduledLesson.update({
      where: { id: lessonId },
      data: { isPaid: true },
    });

    return NextResponse.json({ ok: true });
  }

  // Manually mark a specific lesson as unpaid (undo)
  if (action === "markUnpaid" && typeof lessonId === "string") {
    const existingPayment = await prisma.payment.findUnique({ where: { lessonId } });
    if (existingPayment?.comment?.includes("Manually marked")) {
      await prisma.payment.delete({ where: { id: existingPayment.id } });
    } else if (existingPayment) {
      // unlink but keep the payment record
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { lessonId: null },
      });
    }

    await prisma.scheduledLesson.update({
      where: { id: lessonId },
      data: { isPaid: false },
    });

    return NextResponse.json({ ok: true });
  }

  // Assign an unmatched payment to a student
  if (action === "assignPayment" && typeof body === "object" && body !== null) {
    const { paymentId } = body as Record<string, unknown>;
    if (typeof paymentId !== "string" || typeof studentId !== "string") {
      return NextResponse.json({ error: "paymentId and studentId required" }, { status: 400 });
    }

    const now = new Date();
    const nextLesson = await prisma.scheduledLesson.findFirst({
      where: { studentId, isPaid: false, startAt: { gte: now } },
      orderBy: { startAt: "asc" },
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        studentId,
        lessonId: nextLesson?.id ?? null,
      },
    });

    if (nextLesson) {
      await prisma.scheduledLesson.update({
        where: { id: nextLesson.id },
        data: { isPaid: true },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
