import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type StatementItem = {
  id: string;
  time: number;
  description: string;
  comment?: string;
  amount: number;
  currencyCode: number;
  balance: number;
  mcc: number;
  originalMcc: number;
  hold: boolean;
  counterName?: string;
  counterIban?: string;
};

type WebhookBody = {
  type: string;
  data: {
    account: string;
    statementItem: StatementItem;
  };
};

// Monobank sends GET to validate the webhook URL
export async function GET() {
  return new NextResponse("ok", { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  if (body.type !== "StatementItem") {
    return new NextResponse("ok", { status: 200 });
  }

  const item = body.data?.statementItem;
  if (!item) return new NextResponse("ok", { status: 200 });

  // Only process incoming UAH transactions
  if (item.amount <= 0 || item.currencyCode !== 980) {
    return new NextResponse("ok", { status: 200 });
  }

  // Deduplicate — skip if already processed
  const existing = await prisma.payment.findUnique({ where: { monoId: item.id } });
  if (existing) return new NextResponse("ok", { status: 200 });

  // Search for a student paymentCode in comment or description
  const searchText = [item.comment ?? "", item.description ?? ""].join(" ").toUpperCase();

  const students = await prisma.student.findMany({
    select: { id: true, paymentCode: true },
  });

  const matched = students.find((s) => searchText.includes(s.paymentCode.toUpperCase()));

  if (!matched) {
    // Store as unmatched — teacher can assign manually
    await prisma.payment.create({
      data: {
        studentId: students[0]?.id ?? "",
        monoId: item.id,
        amount: item.amount,
        lessonsCount: 0,
        comment: [item.comment, item.description].filter(Boolean).join(" | ") || null,
        receivedAt: new Date(item.time * 1000),
      },
    });
    return new NextResponse("ok", { status: 200 });
  }

  // Resolve lesson price: student price → group price → global price
  const studentWithGroups = await prisma.student.findUnique({
    where: { id: matched.id },
    select: {
      lessonPrice: true,
      groups: { select: { group: { select: { lessonPrice: true } } } },
    },
  });

  const groupPrice = studentWithGroups?.groups
    .map((g) => g.group.lessonPrice)
    .find((p) => p != null) ?? null;

  const globalSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
  const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : 0;

  const lessonPrice = studentWithGroups?.lessonPrice ?? groupPrice ?? globalPrice;

  // Calculate how many lessons this payment covers
  const lessonsCount = lessonPrice > 0 ? Math.floor(item.amount / lessonPrice) : 1;

  // Create payment record first
  const payment = await prisma.payment.create({
    data: {
      studentId: matched.id,
      monoId: item.id,
      amount: item.amount,
      lessonsCount,
      comment: [item.comment, item.description].filter(Boolean).join(" | ") || null,
      receivedAt: new Date(item.time * 1000),
    },
  });

  // Find the next N unpaid upcoming lessons for this student
  const now = new Date();
  const upcomingLessons = await prisma.scheduledLesson.findMany({
    where: {
      studentId: matched.id,
      isPaid: false,
      startAt: { gte: now },
    },
    orderBy: { startAt: "asc" },
    take: lessonsCount,
  });

  // Mark them all paid and link to this payment
  for (const lesson of upcomingLessons) {
    await prisma.scheduledLesson.update({
      where: { id: lesson.id },
      data: { isPaid: true, paymentId: payment.id },
    });
  }

  console.log(
    `[monobank webhook] payment ${payment.id} — student ${matched.id}`,
    `amount: ${item.amount / 100} UAH, price/lesson: ${lessonPrice / 100} UAH`,
    `covers ${lessonsCount} lesson(s), marked ${upcomingLessons.length} paid`
  );

  return new NextResponse("ok", { status: 200 });
}
