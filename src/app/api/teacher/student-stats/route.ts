import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Super-admins see all students; regular teachers see only their own
  const studentFilter = teacher.isSuperAdmin ? {} : { teacherId: teacher.id };

  const students = await prisma.student.findMany({
    where: studentFilter,
    select: {
      id: true,
      name: true,
      email: true,
      lessonPrice: true,
      groups: { select: { group: { select: { id: true, lessonPrice: true } } } },
      payments: {
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: { receivedAt: true, amount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Global lesson price fallback
  const globalSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
  const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : 0;

  // Total paid per student (amount + lessonsCount)
  const totalPaidRaw = await prisma.payment.groupBy({
    by: ["studentId"],
    _sum: { amount: true, lessonsCount: true },
    where: { studentId: { in: students.map((s) => s.id) } },
  });
  const totalPaidMap = new Map(totalPaidRaw.map((r) => [r.studentId, { amount: r._sum.amount ?? 0, lessonsCount: r._sum.lessonsCount ?? 0 }]));

  // Individual lesson counts
  const [futurePaidInd, overdueInd, pastPaidInd] = await Promise.all([
    prisma.scheduledLesson.groupBy({
      by: ["studentId"],
      _count: { id: true },
      where: { studentId: { in: students.map((s) => s.id) }, isPaid: true, startAt: { gt: now } },
    }),
    prisma.scheduledLesson.groupBy({
      by: ["studentId"],
      _count: { id: true },
      where: { studentId: { in: students.map((s) => s.id) }, isPaid: false, startAt: { lt: now } },
    }),
    prisma.scheduledLesson.groupBy({
      by: ["studentId"],
      _count: { id: true },
      where: { studentId: { in: students.map((s) => s.id) }, isPaid: true, startAt: { lte: now } },
    }),
  ]);
  const futurePaidIndMap = new Map(futurePaidInd.map((r) => [r.studentId!, r._count.id]));
  const overdueIndMap = new Map(overdueInd.map((r) => [r.studentId!, r._count.id]));
  const pastPaidIndMap = new Map(pastPaidInd.map((r) => [r.studentId!, r._count.id]));

  // Group lesson counts (via GroupLessonPayment)
  const allGroupIds = Array.from(new Set(students.flatMap((s) => s.groups.map((g) => g.group.id))));

  const groupLessons = allGroupIds.length > 0
    ? await prisma.scheduledLesson.findMany({
        where: { groupId: { in: allGroupIds } },
        select: { id: true, groupId: true, startAt: true },
      })
    : [];

  const paidGlps = groupLessons.length > 0
    ? await prisma.groupLessonPayment.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          lessonId: { in: groupLessons.map((l) => l.id) },
          isPaid: true,
        },
        select: { studentId: true, lessonId: true },
      })
    : [];

  // Build set of paid group lessonIds per student
  const paidGlpSet = new Set(paidGlps.map((g) => `${g.studentId}:${g.lessonId}`));

  // Build per-student group stats
  const futurePaidGroupMap = new Map<string, number>();
  const overdueGroupMap = new Map<string, number>();
  const pastPaidGroupMap = new Map<string, number>();

  for (const student of students) {
    const groupIds = student.groups.map((g) => g.group.id);
    const relevantLessons = groupLessons.filter((l) => groupIds.includes(l.groupId!));
    let futurePaid = 0;
    let overdueCount = 0;
    let pastPaid = 0;
    for (const lesson of relevantLessons) {
      const isPaid = paidGlpSet.has(`${student.id}:${lesson.id}`);
      if (lesson.startAt > now) {
        if (isPaid) futurePaid++;
      } else {
        if (!isPaid) overdueCount++;
        else pastPaid++;
      }
    }
    futurePaidGroupMap.set(student.id, futurePaid);
    overdueGroupMap.set(student.id, overdueCount);
    pastPaidGroupMap.set(student.id, pastPaid);
  }

  const result = students.map((s) => {
    const groupPrice = s.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;
    const priceKopecks = s.lessonPrice ?? groupPrice ?? globalPrice;

    const futurePaid = (futurePaidIndMap.get(s.id) ?? 0) + (futurePaidGroupMap.get(s.id) ?? 0);
    const overdue = (overdueIndMap.get(s.id) ?? 0) + (overdueGroupMap.get(s.id) ?? 0);
    const pastPaid = (pastPaidIndMap.get(s.id) ?? 0) + (pastPaidGroupMap.get(s.id) ?? 0);

    const totals = totalPaidMap.get(s.id) ?? { amount: 0, lessonsCount: 0 };
    const totalLessonsPurchased = totals.lessonsCount;
    const balanceLessons = Math.max(0, totalLessonsPurchased - pastPaid);

    const lastPaymentAt = s.payments[0]?.receivedAt ?? null;

    return {
      studentId: s.id,
      name: s.name,
      email: s.email,
      pricePerLesson: Math.round(priceKopecks / 100),
      futurePaidLessons: futurePaid,
      futurePaidAmount: Math.round((futurePaid * priceKopecks) / 100),
      overdueLessons: overdue,
      overdueAmount: Math.round((overdue * priceKopecks) / 100),
      totalPaidAmount: Math.round(totals.amount / 100),
      balanceLessons,
      balanceAmount: Math.round((balanceLessons * priceKopecks) / 100),
      lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
    };
  });

  return NextResponse.json(result);
}
