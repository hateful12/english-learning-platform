import { NextRequest, NextResponse } from "next/server";
import { createVerify } from "crypto";
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

/**
 * Verify the Monobank X-Sign header using the public key from environment.
 * https://api.monobank.ua/docs/corporate.html#tag/Povydomlennya-pro-vxidni-platezhi/paths/~1personal~1webhook/post
 */
async function verifyMonobankSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const publicKeyPem = process.env.MONOBANK_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyPem) {
    console.warn("[monobank webhook] MONOBANK_WEBHOOK_PUBLIC_KEY is not set — skipping signature check");
    return false;
  }
  const signature = request.headers.get("X-Sign");
  if (!signature) return false;
  try {
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    return verifier.verify(publicKeyPem, signature, "base64");
  } catch {
    return false;
  }
}

// Monobank sends GET to validate the webhook URL
export async function GET() {
  return new NextResponse("ok", { status: 200 });
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  let body: WebhookBody;
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const isValid = await verifyMonobankSignature(request, rawBody);
  if (!isValid) {
    return new NextResponse("forbidden", { status: 403 });
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
    // No student code found — log and skip to avoid assigning payment to the wrong student.
    // The teacher can reconcile unmatched payments manually via bank statements.
    console.warn(
      `[monobank webhook] unmatched payment monoId=${item.id} amount=${item.amount} comment="${item.comment ?? ""}" description="${item.description ?? ""}"`
    );
    return new NextResponse("ok", { status: 200 });
  }

  // Resolve lesson price: student price → group price → global price
  const studentWithGroups = await prisma.student.findUnique({
    where: { id: matched.id },
    select: {
      lessonPrice: true,
      groups: { select: { group: { select: { id: true, lessonPrice: true } } } },
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

  const now = new Date();
  let markedCount = 0;
  let remaining = lessonsCount;

  // 1. Mark individual lessons (studentId = matched.id)
  if (remaining > 0) {
    const individualLessons = await prisma.scheduledLesson.findMany({
      where: {
        studentId: matched.id,
        isPaid: false,
        startAt: { gte: now },
      },
      orderBy: { startAt: "asc" },
      take: remaining,
    });

    for (const lesson of individualLessons) {
      await prisma.scheduledLesson.update({
        where: { id: lesson.id },
        data: { isPaid: true, paymentId: payment.id },
      });
      markedCount++;
      remaining--;
    }
  }

  // 2. Mark group lessons via GroupLessonPayment
  if (remaining > 0 && studentWithGroups?.groups.length) {
    const groupIds = studentWithGroups.groups.map((g) => g.group.id);

    // Find upcoming group lessons where this student doesn't yet have a paid GroupLessonPayment
    for (const groupId of groupIds) {
      if (remaining <= 0) break;

      // Get all upcoming lessons for this group, ordered by startAt
      const groupLessons = await prisma.scheduledLesson.findMany({
        where: {
          groupId,
          startAt: { gte: now },
        },
        orderBy: { startAt: "asc" },
      });

      for (const lesson of groupLessons) {
        if (remaining <= 0) break;

        // Upsert GroupLessonPayment — mark paid for this student
        const existingGlp = await prisma.groupLessonPayment.findUnique({
          where: { studentId_lessonId: { studentId: matched.id, lessonId: lesson.id } },
        });

        if (existingGlp?.isPaid) continue; // already paid

        await prisma.groupLessonPayment.upsert({
          where: { studentId_lessonId: { studentId: matched.id, lessonId: lesson.id } },
          update: { isPaid: true, paymentId: payment.id },
          create: { studentId: matched.id, lessonId: lesson.id, isPaid: true, paymentId: payment.id },
        });

        markedCount++;
        remaining--;
      }
    }
  }

  console.log(
    `[monobank webhook] payment ${payment.id} — student ${matched.id}`,
    `amount: ${item.amount / 100} UAH, price/lesson: ${lessonPrice / 100} UAH`,
    `covers ${lessonsCount} lesson(s), marked ${markedCount} paid`
  );

  return new NextResponse("ok", { status: 200 });
}
