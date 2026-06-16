import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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

  // Total paid per student (monetary only — lessonsCount is unreliable if price changed over time)
  const totalPaidRaw = await prisma.payment.groupBy({
    by: ["studentId"],
    _sum: { amount: true },
    where: { studentId: { in: students.map((s) => s.id) } },
  });
  const totalPaidMap = new Map(totalPaidRaw.map((r) => [r.studentId, r._sum.amount ?? 0]));

  // Use ISO string for startAt comparison — Prisma passes Date as integer to SQLite
  // but stored values are text, causing type mismatch (text > integer always in SQLite).
  const nowIso = now.toISOString();
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) return NextResponse.json([]);

  // Individual lesson counts — raw SQL for reliable text datetime comparison
  const [futurePaidRaw, overdueRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ studentId: string; cnt: bigint }>>`
      SELECT studentId, COUNT(id) as cnt FROM "ScheduledLesson"
      WHERE studentId IN (${Prisma.join(studentIds)})
        AND isPaid = 1 AND startAt > ${nowIso}
      GROUP BY studentId`,
    prisma.$queryRaw<Array<{ studentId: string; cnt: bigint }>>`
      SELECT studentId, COUNT(id) as cnt FROM "ScheduledLesson"
      WHERE studentId IN (${Prisma.join(studentIds)})
        AND isPaid = 0 AND startAt < ${nowIso}
      GROUP BY studentId`,
  ]);
  const futurePaidIndMap = new Map(futurePaidRaw.map((r) => [r.studentId, Number(r.cnt) || 0]));
  const overdueIndMap = new Map(overdueRaw.map((r) => [r.studentId, Number(r.cnt) || 0]));

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

  for (const student of students) {
    const groupIds = student.groups.map((g) => g.group.id);
    const relevantLessons = groupLessons.filter((l) => groupIds.includes(l.groupId!));
    let futurePaid = 0;
    let overdueCount = 0;
    for (const lesson of relevantLessons) {
      const isPaid = paidGlpSet.has(`${student.id}:${lesson.id}`);
      // Compare ISO strings directly to avoid SQLite integer vs text issue
      if (lesson.startAt.toISOString() > nowIso) {
        if (isPaid) futurePaid++;
      } else {
        if (!isPaid) overdueCount++;
      }
    }
    futurePaidGroupMap.set(student.id, futurePaid);
    overdueGroupMap.set(student.id, overdueCount);
  }

  const result = students.map((s) => {
    const groupPrice = s.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;
    const priceKopecks = s.lessonPrice ?? groupPrice ?? globalPrice;

    const futurePaid = (futurePaidIndMap.get(s.id) ?? 0) + (futurePaidGroupMap.get(s.id) ?? 0);
    const overdue = (overdueIndMap.get(s.id) ?? 0) + (overdueGroupMap.get(s.id) ?? 0);

    const totalAmountKopecks = totalPaidMap.get(s.id) ?? 0;
    // Balance = future lessons already paid for (same logic as student view)
    const balanceLessons = futurePaid;

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
      totalPaidAmount: Math.round(totalAmountKopecks / 100),
      balanceLessons,
      balanceAmount: Math.round((balanceLessons * priceKopecks) / 100),
      lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
    };
  });

  return NextResponse.json(result);
}
