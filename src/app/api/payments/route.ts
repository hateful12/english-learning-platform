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
      lessons: { select: { id: true, title: true, startAt: true }, orderBy: { startAt: "asc" } },
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

  const { action, lessonId, studentId, amount, paidAt } = (body as Record<string, unknown>) ?? {};

  // Manually mark a specific lesson as paid
  if (action === "markPaid" && typeof lessonId === "string") {
    const lesson = await prisma.scheduledLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const sId = typeof studentId === "string" ? studentId : lesson.studentId;
    if (!sId) return NextResponse.json({ error: "No student associated" }, { status: 400 });

    const paidAmount = typeof amount === "number" && amount > 0 ? amount : 0;
    const receivedAt = typeof paidAt === "string" && paidAt ? new Date(paidAt) : new Date();

    if (!lesson.paymentId) {
      const payment = await prisma.payment.create({
        data: {
          studentId: sId,
          monoId: `manual_${lessonId}_${Date.now()}`,
          amount: paidAmount,
          lessonsCount: 1,
          comment: "Manually marked as paid by teacher",
          receivedAt,
        },
      });
      await prisma.scheduledLesson.update({
        where: { id: lessonId },
        data: { isPaid: true, paymentId: payment.id },
      });
    } else {
      // Update existing payment record with amount/date if provided
      if (paidAmount > 0 || paidAt) {
        await prisma.payment.update({
          where: { id: lesson.paymentId },
          data: {
            ...(paidAmount > 0 && { amount: paidAmount }),
            ...(paidAt && { receivedAt }),
          },
        });
      }
      await prisma.scheduledLesson.update({
        where: { id: lessonId },
        data: { isPaid: true },
      });
    }

    return NextResponse.json({ ok: true });
  }

  // Manually mark a specific lesson as unpaid
  if (action === "markUnpaid" && typeof lessonId === "string") {
    const lesson = await prisma.scheduledLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    // If linked to a manual payment, delete it
    if (lesson.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: lesson.paymentId } });
      if (payment?.comment?.includes("Manually marked")) {
        const linkedCount = await prisma.scheduledLesson.count({ where: { paymentId: payment.id } });
        if (linkedCount <= 1) {
          await prisma.scheduledLesson.update({ where: { id: lessonId }, data: { paymentId: null, isPaid: false } });
          await prisma.payment.delete({ where: { id: payment.id } });
          return NextResponse.json({ ok: true });
        }
      }
    }

    await prisma.scheduledLesson.update({
      where: { id: lessonId },
      data: { isPaid: false, paymentId: null },
    });

    return NextResponse.json({ ok: true });
  }

  // Assign an unmatched payment to a student
  if (action === "assignPayment") {
    const { paymentId } = body as Record<string, unknown>;
    if (typeof paymentId !== "string" || typeof studentId !== "string") {
      return NextResponse.json({ error: "paymentId and studentId required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    // Recalculate lessonsCount based on lesson price
    const priceSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
    const lessonPrice = priceSetting ? parseInt(priceSetting.value, 10) : 0;
    const lessonsCount = lessonPrice > 0 ? Math.floor(payment.amount / lessonPrice) : 1;

    // Update student assignment and lessonsCount
    await prisma.payment.update({
      where: { id: paymentId },
      data: { studentId, lessonsCount },
    });

    // Find and mark the next N unpaid upcoming lessons
    const now = new Date();
    const upcomingLessons = await prisma.scheduledLesson.findMany({
      where: { studentId, isPaid: false, startAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: lessonsCount,
    });

    for (const lesson of upcomingLessons) {
      await prisma.scheduledLesson.update({
        where: { id: lesson.id },
        data: { isPaid: true, paymentId },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
