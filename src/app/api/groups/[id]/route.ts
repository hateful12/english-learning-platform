import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const updateData: Record<string, unknown> = {};
    if (name && typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }

    if (Array.isArray(studentIds)) {
      const ids = (studentIds as unknown[]).filter((id): id is string => typeof id === "string");
      // Replace all members: delete existing then insert new
      await prisma.$transaction([
        prisma.studentGroup.deleteMany({ where: { groupId: params.id } }),
        ...ids.map((studentId) =>
          prisma.studentGroup.create({ data: { groupId: params.id, studentId } })
        ),
      ]);
    }

    const group = await prisma.group.update({
      where: { id: params.id },
      data: updateData,
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
    console.error("PATCH /api/groups/[id] error:", err);
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Detach homework from this group before deleting
    await prisma.homework.updateMany({
      where: { groupId: params.id },
      data: { groupId: null },
    });
    await prisma.group.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/groups/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
