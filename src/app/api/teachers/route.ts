import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession, SUPER_ADMIN_EMAIL } from "@/lib/auth";

function normalizeRole(role: string, email: string) {
  if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) return "super-admin";
  if (role === "admin" || role === "super-admin") return "super-admin";
  return "teacher";
}

export async function GET() {
  const teacher = await getTeacherSession();
  if (!teacher?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teachers = await prisma.teacher.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { students: true } },
    },
  });

  return NextResponse.json(
    teachers.map((t) => ({
      id: t.id,
      email: t.email,
      role: normalizeRole(t.role, t.email),
      createdAt: t.createdAt,
      studentsCount: t._count.students,
    }))
  );
}
