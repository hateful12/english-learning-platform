import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET — return (and lazily assign) the student's permanent paymentCents identifier (1-99).
 * This single-kopeck suffix is added to every transfer amount so the webhook can
 * match the payment to this student even when the bank strips the comment field.
 *
 * Matching rule in the webhook: amount % 100 === student.paymentCents
 */
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      paymentCents: true,
      lessonPrice: true,
      groups: { select: { group: { select: { lessonPrice: true } } } },
    },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already assigned
  if (student.paymentCents != null) {
    return NextResponse.json({ cents: student.paymentCents });
  }

  // Find next available slot 1-99
  const taken = await prisma.student.findMany({
    where: { paymentCents: { not: null } },
    select: { paymentCents: true },
  });
  const takenSet = new Set(taken.map((s) => s.paymentCents));
  let cents: number | null = null;
  for (let i = 1; i <= 99; i++) {
    if (!takenSet.has(i)) { cents = i; break; }
  }

  if (cents === null) {
    return NextResponse.json({ error: "All identifier slots used (max 99 students)" }, { status: 503 });
  }

  await prisma.student.update({ where: { id: studentId }, data: { paymentCents: cents } });

  return NextResponse.json({ cents });
}
