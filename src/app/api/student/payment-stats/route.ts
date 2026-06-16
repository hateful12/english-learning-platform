import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  // Use ISO string for comparison — Prisma passes Date as integer to SQLite
  // but stored startAt values are text; text > integer always in SQLite.
  const nowIso = now.toISOString();

  // ── Individual lessons — raw SQL for reliable text datetime comparison ────
  const [futurePaidRaw, overdueRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(id) as cnt FROM "ScheduledLesson"
      WHERE studentId = ${studentId} AND isPaid = 1 AND startAt > ${nowIso}`,
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(id) as cnt FROM "ScheduledLesson"
      WHERE studentId = ${studentId} AND isPaid = 0 AND startAt < ${nowIso}`,
  ]);
  const futurePaidInd = Number(futurePaidRaw[0]?.cnt ?? 0n);
  const overdueInd = Number(overdueRaw[0]?.cnt ?? 0n);

  // ── Group lessons ─────────────────────────────────────────────────────────
  const studentGroups = await prisma.studentGroup.findMany({
    where: { studentId },
    select: { groupId: true },
  });
  const groupIds = studentGroups.map((g) => g.groupId);

  let futurePaidGroup = 0;
  let overdueGroup = 0;

  if (groupIds.length > 0) {
    const groupLessons = await prisma.scheduledLesson.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true, startAt: true },
    });

    const paidGlps = await prisma.groupLessonPayment.findMany({
      where: { studentId, isPaid: true, lessonId: { in: groupLessons.map((l) => l.id) } },
      select: { lessonId: true },
    });
    const paidLessonIds = new Set(paidGlps.map((g) => g.lessonId));

    for (const lesson of groupLessons) {
      const isPaid = paidLessonIds.has(lesson.id);
      if (lesson.startAt.toISOString() > nowIso) {
        if (isPaid) futurePaidGroup++;
      } else {
        if (!isPaid) overdueGroup++;
      }
    }
  }

  // ── Lesson price ──────────────────────────────────────────────────────────
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      lessonPrice: true,
      groups: { select: { group: { select: { lessonPrice: true } } } },
    },
  });
  const groupPrice = student?.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;
  const globalSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
  const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : 0;
  const priceKopecks = student?.lessonPrice ?? groupPrice ?? globalPrice;

  const totalPaid = await prisma.payment.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  const totalAmountPaidKopecks = totalPaid._sum.amount ?? 0;

  const futurePaid = futurePaidInd + futurePaidGroup;
  const overdue = overdueInd + overdueGroup;

  // Balance = future lessons already paid for (simplest and correct definition)
  const balanceLessons = futurePaid;
  const balanceAmount = Math.round((balanceLessons * priceKopecks) / 100);

  return NextResponse.json({
    futurePaidLessons: futurePaid,
    futurePaidAmount: Math.round((futurePaid * priceKopecks) / 100),
    overdueLessons: overdue,
    overdueAmount: Math.round((overdue * priceKopecks) / 100),
    pricePerLesson: Math.round(priceKopecks / 100),
    balanceLessons,
    balanceAmount,
    totalAmountPaid: Math.round(totalAmountPaidKopecks / 100),
  });
}
