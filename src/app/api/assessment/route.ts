import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId, isTeacherLoggedIn } from "@/lib/auth";

// GET /api/assessment
// Student: returns their own assessments
// Teacher: returns all students' latest completed assessment (for badge display)
export async function GET() {
  try {
    const teacher = await isTeacherLoggedIn();

    if (teacher) {
      // Return the latest completed assessment for every student
      const students = await prisma.student.findMany({
        select: { id: true },
      });
      const latestMap: Record<string, { level: string; score: number; completedAt: Date } | null> = {};
      await Promise.all(
        students.map(async (s) => {
          const latest = await prisma.assessment.findFirst({
            where: { studentId: s.id, status: "completed" },
            orderBy: { completedAt: "desc" },
            select: { level: true, score: true, completedAt: true },
          });
          latestMap[s.id] = latest
            ? { level: latest.level ?? "", score: latest.score ?? 0, completedAt: latest.completedAt! }
            : null;
        })
      );
      return NextResponse.json(latestMap);
    }

    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assessments = await prisma.assessment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        level: true,
        skill: true,
        score: true,
        feedback: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json(assessments);
  } catch (err) {
    console.error("GET /api/assessment error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load assessments", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
