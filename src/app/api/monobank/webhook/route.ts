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

async function verifyMonobankSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const publicKeyPem = process.env.MONOBANK_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyPem) return true; // Personal API — no X-Sign
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

export async function GET() {
  return new NextResponse("ok", { status: 200 });
}

/**
 * Resolve lesson price for a student (student override → group price → global setting).
 */
async function resolveLessonPrice(studentId: string): Promise<{ lessonPrice: number; groups: { id: string }[] }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      lessonPrice: true,
      groups: { select: { group: { select: { id: true, lessonPrice: true } } } },
    },
  });
  const groupPrice = student?.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;
  const globalSetting = await prisma.settings.findUnique({ where: { key: "lesson_price" } });
  const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : 0;
  const lessonPrice = student?.lessonPrice ?? groupPrice ?? globalPrice;
  const groups = (student?.groups ?? []).map((g) => ({ id: g.group.id }));
  return { lessonPrice, groups };
}

/**
 * Create a Payment record and mark upcoming lessons as paid for the given student.
 * Returns the created Payment.
 */
async function creditStudent(
  studentId: string,
  amount: number,
  monoId: string,
  comment: string | null,
  receivedAt: Date,
) {
  const { lessonPrice, groups } = await resolveLessonPrice(studentId);
  const lessonsCount = lessonPrice > 0 ? Math.floor(amount / lessonPrice) : 1;

  const payment = await prisma.payment.create({
    data: { studentId, monoId, amount, lessonsCount, comment, receivedAt },
  });

  const now = new Date();
  let remaining = lessonsCount;

  // 1. Individual lessons
  if (remaining > 0) {
    const lessons = await prisma.scheduledLesson.findMany({
      where: { studentId, isPaid: false, startAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: remaining,
    });
    for (const lesson of lessons) {
      await prisma.scheduledLesson.update({ where: { id: lesson.id }, data: { isPaid: true, paymentId: payment.id } });
      remaining--;
    }
  }

  // 2. Group lessons
  if (remaining > 0 && groups.length) {
    for (const { id: groupId } of groups) {
      if (remaining <= 0) break;
      const groupLessons = await prisma.scheduledLesson.findMany({
        where: { groupId, startAt: { gte: now } },
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
          update: { isPaid: true, paymentId: payment.id },
          create: { studentId, lessonId: lesson.id, isPaid: true, paymentId: payment.id },
        });
        remaining--;
      }
    }
  }

  console.log(
    `[mono webhook] credited student=${studentId} amount=${amount / 100}₴`,
    `lessonPrice=${lessonPrice / 100}₴ lessons=${lessonsCount} monoId=${monoId}`,
  );

  return payment;
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

  if (!(await verifyMonobankSignature(request, rawBody))) {
    return new NextResponse("forbidden", { status: 403 });
  }

  if (body.type !== "StatementItem") return new NextResponse("ok", { status: 200 });

  const item = body.data?.statementItem;
  if (!item) return new NextResponse("ok", { status: 200 });

  // Only incoming UAH
  if (item.amount <= 0 || item.currencyCode !== 980) return new NextResponse("ok", { status: 200 });

  // Deduplicate
  const existing = await prisma.payment.findUnique({ where: { monoId: item.id } });
  if (existing) return new NextResponse("ok", { status: 200 });

  const receivedAt = new Date(item.time * 1000);
  const comment = [item.comment, item.description].filter(Boolean).join(" | ") || null;

  // ── 1. Match by payment code in comment ──────────────────────────────────
  const searchText = [item.comment ?? "", item.description ?? ""].join(" ").toUpperCase();
  const students = await prisma.student.findMany({ select: { id: true, paymentCode: true } });
  const codeMatch = students.find((s) => searchText.includes(s.paymentCode.toUpperCase()));

  if (codeMatch) {
    await creditStudent(codeMatch.id, item.amount, item.id, comment, receivedAt);
    return new NextResponse("ok", { status: 200 });
  }

  // ── 2. Match by unique amount (PaymentIntent) ─────────────────────────────
  const now = new Date();
  const intents = await prisma.paymentIntent.findMany({
    where: { uniqueAmount: item.amount, status: "pending", expiresAt: { gte: now } },
  });

  if (intents.length === 1) {
    const intent = intents[0];
    const payment = await creditStudent(intent.studentId, item.amount, item.id, comment, receivedAt);
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "matched", paymentId: payment.id },
    });
    console.log(`[mono webhook] matched by uniqueAmount=${item.amount} → intent=${intent.id}`);
    return new NextResponse("ok", { status: 200 });
  }

  if (intents.length > 1) {
    // Collision — flag all for manual review
    await prisma.paymentIntent.updateMany({
      where: { id: { in: intents.map((i) => i.id) } },
      data: { status: "manual_review" },
    });
    console.warn(`[mono webhook] amount collision: ${intents.length} intents for amount=${item.amount}, monoId=${item.id}`);
    return new NextResponse("ok", { status: 200 });
  }

  // ── 3. No match ───────────────────────────────────────────────────────────
  console.warn(
    `[mono webhook] unmatched monoId=${item.id} amount=${item.amount / 100}₴`,
    `comment="${item.comment ?? ""}" description="${item.description ?? ""}"`,
  );
  return new NextResponse("ok", { status: 200 });
}
