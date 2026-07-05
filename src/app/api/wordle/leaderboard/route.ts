import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET: Leaderboard of all students who have played at least once */
export async function GET() {
  const games = await prisma.wordleGame.findMany({
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "asc" },
  });

  const byStudent = new Map<
    string,
    { name: string; email: string; wins: number; played: number; distribution: number[]; games: { date: string; result: string; tries: number }[] }
  >();

  for (const g of games) {
    const id = g.studentId;
    if (!byStudent.has(id)) {
      byStudent.set(id, {
        name: g.student.name ?? g.student.email,
        email: g.student.email,
        wins: 0,
        played: 0,
        distribution: [0, 0, 0, 0, 0, 0, 0],
        games: [],
      });
    }
    const s = byStudent.get(id)!;
    s.played++;
    s.games.push({ date: g.date, result: g.result, tries: g.tries });
    if (g.result === "won") {
      s.wins++;
      s.distribution[g.tries - 1]++;
    } else {
      s.distribution[6]++;
    }
  }

  const leaderboard = Array.from(byStudent.entries())
    .map(([id, s]) => {
      const { games, ...rest } = s;
      const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));
      let streak = 0;
      let prevDate: string | null = null;
      for (const g of sorted) {
        if (g.result !== "won") break;
        if (prevDate) {
          const prev = new Date(prevDate);
          const curr = new Date(g.date);
          const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
          if (diffDays !== 1) break;
        }
        streak++;
        prevDate = g.date;
      }
      return { studentId: id, ...rest, streak };
    })
    .sort((a, b) => b.wins - a.wins || b.played - a.played);

  return NextResponse.json(leaderboard);
}
