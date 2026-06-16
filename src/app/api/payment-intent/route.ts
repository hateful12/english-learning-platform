import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

export const runtime = "nodejs";

const INTENT_TTL_MS = 60 * 60 * 1000; // 1 hour

/** GET — return the active (pending) intent for the current student, or null */
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Expire stale intents first
  await prisma.paymentIntent.updateMany({
    where: { studentId, status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });

  const intent = await prisma.paymentIntent.findFirst({
    where: { studentId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(intent ?? null);
}

/** POST — create a new payment intent for the current student */
export async function POST(req: NextRequest) {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { lessonsCount } = (body as Record<string, unknown>) ?? {};

  // Resolve lesson price for this student
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
  const pricePerLesson = student?.lessonPrice ?? groupPrice ?? globalPrice;

  if (!pricePerLesson || pricePerLesson <= 0) {
    return NextResponse.json({ error: "Lesson price not set. Contact your teacher." }, { status: 400 });
  }

  const count = typeof lessonsCount === "number" && lessonsCount > 0 ? Math.round(lessonsCount) : 1;
  const requestedAmount = pricePerLesson * count; // kopecks
  const randomCents = Math.floor(Math.random() * 99) + 1; // 1-99 kopecks
  const uniqueAmount = requestedAmount + randomCents;

  const expiresAt = new Date(Date.now() + INTENT_TTL_MS);

  // Cancel any previously pending intent for this student
  await prisma.paymentIntent.updateMany({
    where: { studentId, status: "pending" },
    data: { status: "expired" },
  });

  const intent = await prisma.paymentIntent.create({
    data: { studentId, requestedAmount, uniqueAmount, expiresAt },
  });

  // Return the card number too so the client doesn't need another fetch
  const cardSetting = await prisma.settings.findUnique({ where: { key: "monobank_card" } });

  return NextResponse.json({
    id: intent.id,
    requestedAmount: intent.requestedAmount,
    uniqueAmount: intent.uniqueAmount,
    expiresAt: intent.expiresAt,
    card: cardSetting?.value ?? null,
  });
}

/** DELETE — cancel the active intent for the current student */
export async function DELETE() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.paymentIntent.updateMany({
    where: { studentId, status: "pending" },
    data: { status: "expired" },
  });

  return NextResponse.json({ ok: true });
}
