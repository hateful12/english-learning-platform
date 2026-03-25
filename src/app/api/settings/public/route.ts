import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

// Public endpoint for students to read their resolved lesson price and card info
export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [student, globalSetting, cardSetting] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        lessonPrice: true,
        groups: { select: { group: { select: { lessonPrice: true } } } },
      },
    }),
    prisma.settings.findUnique({ where: { key: "lesson_price" } }),
    prisma.settings.findUnique({ where: { key: "monobank_card" } }),
  ]);

  const groupPrice =
    student?.groups.map((g) => g.group.lessonPrice).find((p) => p != null) ?? null;

  const globalPrice = globalSetting ? parseInt(globalSetting.value, 10) : null;

  // Resolved price in kopecks (student → group → global)
  const resolvedKopecks = student?.lessonPrice ?? groupPrice ?? globalPrice;

  return NextResponse.json({
    lessonPrice: resolvedKopecks != null ? resolvedKopecks / 100 : null,
    monobankCard: cardSetting?.value ?? null,
  });
}
