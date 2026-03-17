import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** POST: Submit a Wordle game result */
export async function POST(req: Request) {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; result?: string; tries?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, result, tries } = body;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (result !== "won" && result !== "lost") ||
    typeof tries !== "number" ||
    tries < 1 ||
    tries > 7
  ) {
    return NextResponse.json({ error: "Invalid date, result, or tries" }, { status: 400 });
  }

  if (result === "won" && (tries < 1 || tries > 6)) {
    return NextResponse.json({ error: "Won games must have tries 1-6" }, { status: 400 });
  }
  if (result === "lost" && tries !== 7) {
    return NextResponse.json({ error: "Lost games must have tries 7" }, { status: 400 });
  }

  await prisma.wordleGame.upsert({
    where: {
      studentId_date: { studentId, date },
    },
    create: { studentId, date, result, tries },
    update: { result, tries },
  });

  return NextResponse.json({ ok: true });
}
