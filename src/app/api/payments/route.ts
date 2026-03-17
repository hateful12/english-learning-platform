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
      groupLessonPayments: {
        select: { lessonId: true, lesson: { select: { id: true, title: true, startAt: true } } },
        orderBy: { lesson: { startAt: "asc" } },
      },
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

  // ─── markPaid ──────────────────────────────────────────────────────────────
  if (action === "markPaid" && typeof lessonId === "string") {
    const lesson = await prisma.scheduledLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const paidAmount = typeof amount === "number" && amount > 0 ? amount : 0;
    const receivedAt = typeof paidAt === "string" && paidAt ? new Date(paidAt) : new Date();

    // GROUP LESSON — track per student via GroupLessonPayment
    if (lesson.groupId) {
      const sId = typeof studentId === "string" ? studentId : null;
      if (!sId) return NextResponse.json({ error: "studentId required for group lessons" }, { status: 400 });

      const existing = await prisma.groupLessonPayment.findUnique({
        where: { studentId_lessonId: { studentId: sId, lessonId } },
      });

      if (existing?.paymentId) {
        // Already linked to a payment — just flip flag
        await prisma.groupLessonPayment.update({
          where: { studentId_lessonId: { studentId: sId, lessonId } },
          data: { isPaid: true },
        });
      } else {
        // Create a manual payment and link it
        const payment = await prisma.payment.create({
          data: {
            studentId: sId,
            monoId: `manual_glp_${lessonId}_${sId}_${Date.now()}`,
            amount: paidAmount,
            lessonsCount: 1,
            comment: "Manually marked as paid by teacher",
            receivedAt,
          },
        });
        await prisma.groupLessonPayment.upsert({
          where: { studentId_lessonId: { studentId: sId, lessonId } },
          update: { isPaid: true, paymentId: payment.id },
          create: { studentId: sId, lessonId, isPaid: true, paymentId: payment.id },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // INDIVIDUAL LESSON — existing logic
    const sId = typeof studentId === "string" ? studentId : lesson.studentId;
    if (!sId) return NextResponse.json({ error: "No student associated" }, { status: 400 });

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
      if (paidAmount > 0 || paidAt) {
        await prisma.payment.update({
          where: { id: lesson.paymentId },
          data: {
            ...(paidAmount > 0 ? { amount: paidAmount } : {}),
            ...(paidAt ? { receivedAt } : {}),
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

  // ─── markUnpaid ────────────────────────────────────────────────────────────
  if (action === "markUnpaid" && typeof lessonId === "string") {
    const lesson = await prisma.scheduledLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    // GROUP LESSON
    if (lesson.groupId) {
      const sId = typeof studentId === "string" ? studentId : null;
      if (!sId) return NextResponse.json({ error: "studentId required for group lessons" }, { status: 400 });

      const glp = await prisma.groupLessonPayment.findUnique({
        where: { studentId_lessonId: { studentId: sId, lessonId } },
      });

      if (glp?.paymentId) {
        const payment = await prisma.payment.findUnique({ where: { id: glp.paymentId } });
        if (payment?.comment?.includes("Manually marked")) {
          const linkedCount = await prisma.groupLessonPayment.count({ where: { paymentId: payment.id } });
          if (linkedCount <= 1) {
            await prisma.groupLessonPayment.update({
              where: { studentId_lessonId: { studentId: sId, lessonId } },
              data: { isPaid: false, paymentId: null },
            });
            await prisma.payment.delete({ where: { id: payment.id } });
            return NextResponse.json({ ok: true });
          }
        }
      }

      await prisma.groupLessonPayment.upsert({
        where: { studentId_lessonId: { studentId: sId, lessonId } },
        update: { isPaid: false, paymentId: null },
        create: { studentId: sId, lessonId, isPaid: false },
      });
      return NextResponse.json({ ok: true });
    }

    // INDIVIDUAL LESSON
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

  // ─── assignPayment ─────────────────────────────────────────────────────────
  if (action === "assignPayment") {
    const { paymentId } = body as Record<string, unknown>;
    if (typeof paymentId !== "string" || typeof studentId !== "string") {
      return NextResponse.json({ error: "paymentId and studentId required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    // Resolve price hierarchy
    const studentData = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        lessonPrice: true,
        groups: { select: { group: { select: { id: true, lessonPrice: true } } } },
      },
    });
    const groupPrice = studentData?.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;
    const globalSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
    const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : 0;
    const lessonPrice = studentData?.lessonPrice ?? groupPrice ?? globalPrice;
    const lessonsCount = lessonPrice > 0 ? Math.floor(payment.amount / lessonPrice) : 1;

    await prisma.payment.update({
      where: { id: paymentId },
      data: { studentId, lessonsCount },
    });

    const now = new Date();
    let remaining = lessonsCount;

    // Mark individual lessons first
    if (remaining > 0) {
      const individualLessons = await prisma.scheduledLesson.findMany({
        where: { studentId, isPaid: false, startAt: { gte: now } },
        orderBy: { startAt: "asc" },
        take: remaining,
      });
      for (const lesson of individualLessons) {
        await prisma.scheduledLesson.update({
          where: { id: lesson.id },
          data: { isPaid: true, paymentId },
        });
        remaining--;
      }
    }

    // Then mark group lessons
    if (remaining > 0 && studentData?.groups.length) {
      for (const g of studentData.groups) {
        if (remaining <= 0) break;
        const groupLessons = await prisma.scheduledLesson.findMany({
          where: { groupId: g.group.id, startAt: { gte: now } },
          orderBy: { startAt: "asc" },
        });
        for (const lesson of groupLessons) {
          if (remaining <= 0) break;
          const existing = await prisma.groupLessonPayment.findUnique({
            where: { studentId_lessonId: { studentId, lessonId: lesson.id } },
          });
          if (existing?.isPaid) continue;
          await prisma.groupLessonPayment.upsert({
            where: { studentId_lessonId: { studentId, lessonId: lesson.id } },
            update: { isPaid: true, paymentId },
            create: { studentId, lessonId: lesson.id, isPaid: true, paymentId },
          });
          remaining--;
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
