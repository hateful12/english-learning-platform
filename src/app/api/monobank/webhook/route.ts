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
    // Transaction received but no matching student — store as unmatched for teacher review
    await prisma.payment.create({
      data: {
        studentId: students[0]?.id ?? "", // placeholder; teacher can reassign
        monoId: item.id,
        amount: item.amount,
        comment: [item.comment, item.description].filter(Boolean).join(" | ") || null,
        receivedAt: new Date(item.time * 1000),
        // no lessonId — unmatched
      },
    });
    return new NextResponse("ok", { status: 200 });
  }

  // Find the next unpaid upcoming lesson for this student
  const now = new Date();
  const nextLesson = await prisma.scheduledLesson.findFirst({
    where: {
      studentId: matched.id,
      isPaid: false,
      startAt: { gte: now },
    },
    orderBy: { startAt: "asc" },
  });

  const payment = await prisma.payment.create({
    data: {
      studentId: matched.id,
      lessonId: nextLesson?.id ?? null,
      monoId: item.id,
      amount: item.amount,
      comment: [item.comment, item.description].filter(Boolean).join(" | ") || null,
      receivedAt: new Date(item.time * 1000),
    },
  });

  if (nextLesson) {
    await prisma.scheduledLesson.update({
      where: { id: nextLesson.id },
      data: { isPaid: true },
    });
  }

  console.log(
    `[monobank webhook] payment ${payment.id} matched student ${matched.id}`,
    nextLesson ? `lesson ${nextLesson.id} marked paid` : "no upcoming lesson found"
  );

  return new NextResponse("ok", { status: 200 });
}
