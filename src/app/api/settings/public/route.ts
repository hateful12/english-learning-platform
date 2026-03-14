import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

// Public endpoint for students to read lesson price and card info
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.settings.findMany({
    where: { key: { in: ["lesson_price", "monobank_card"] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    lessonPrice: map["lesson_price"] ? parseInt(map["lesson_price"], 10) / 100 : null,
    monobankCard: map["monobank_card"] ?? null,
  });
}
