import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession } from "@/lib/auth";

export const runtime = "nodejs";

/** GET — list recent payment intents for the teacher admin panel */
export async function GET() {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-expire stale intents
  await prisma.paymentIntent.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });

  const intents = await prisma.paymentIntent.findMany({
    where: { status: { in: ["pending", "matched", "manual_review"] } },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(intents);
}
