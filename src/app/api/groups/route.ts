import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function GET() {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        students: {
          include: {
            student: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    const serialized = groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      students: g.students.map((sg) => sg.student),
    }));
    return NextResponse.json(serialized);
  } catch (err) {
    console.error("GET /api/groups error:", err);
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { name, studentIds } = (body as Record<string, unknown>) ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Group name required" }, { status: 400 });
    }
    const ids: string[] = Array.isArray(studentIds)
      ? (studentIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        students: {
          create: ids.map((studentId) => ({ studentId })),
        },
      },
      include: {
        students: {
          include: {
            student: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      students: group.students.map((sg) => sg.student),
    });
  } catch (err) {
    console.error("POST /api/groups error:", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
