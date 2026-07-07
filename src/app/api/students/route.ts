import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTeacherSession, hashPassword, teacherCanAccessStudent } from "@/lib/auth";

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt silently truncates beyond 72 bytes

const studentSelect = {
  id: true,
  email: true,
  name: true,
  paymentCode: true,
  lessonPrice: true,
  level: true,
  teacherId: true,
  teacher: { select: { id: true, email: true } },
  teacherStudents: { select: { teacher: { select: { id: true, email: true } } } },
  isPaused: true,
  pausedAt: true,
  createdAt: true,
} as const;

export async function GET() {
  const teacher = await getTeacherSession();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const students = teacher.isSuperAdmin
    ? await prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        select: studentSelect,
      })
    : await prisma.student.findMany({
        where: {
          OR: [
            { teacherId: teacher.id },
            { teacherStudents: { some: { teacherId: teacher.id } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: studentSelect,
      });
  return NextResponse.json(students);
}

export async function PATCH(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, lessonPrice, level, temporaryPassword, teacherId, teacherIds, paused } = (body as Record<string, unknown>) ?? {};
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  if (!(await teacherCanAccessStudent(teacher, id))) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Pause / resume — removes all schedule entries when pausing
  if (paused !== undefined) {
    if (typeof paused !== "boolean") {
      return NextResponse.json({ error: "paused must be a boolean" }, { status: 400 });
    }

    let lessonsDeleted = 0;
    let groupPaymentsDeleted = 0;

    if (paused) {
      const [individual, groupPayments] = await Promise.all([
        prisma.scheduledLesson.deleteMany({ where: { studentId: id } }),
        prisma.groupLessonPayment.deleteMany({ where: { studentId: id } }),
      ]);
      lessonsDeleted = individual.count;
      groupPaymentsDeleted = groupPayments.count;
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        isPaused: paused,
        pausedAt: paused ? new Date() : null,
      },
      select: studentSelect,
    });

    return NextResponse.json({
      ...updated,
      lessonsDeleted,
      groupPaymentsDeleted,
    });
  }

  const updateData: Record<string, unknown> = {};
  let syncTeacherIds: string[] | null = null;

  if (lessonPrice !== undefined) {
    if (!teacher.isSuperAdmin) {
      return NextResponse.json({ error: "Only the super-admin can edit lesson prices" }, { status: 403 });
    }
    updateData.lessonPrice =
      typeof lessonPrice === "number" && lessonPrice > 0
        ? Math.round(lessonPrice * 100)
        : null;
  }

  // Multi-teacher assignment via teacherIds array (preferred)
  if (teacherIds !== undefined) {
    if (!teacher.isSuperAdmin) {
      return NextResponse.json({ error: "Only the super-admin can assign teachers" }, { status: 403 });
    }
    if (!Array.isArray(teacherIds) || !teacherIds.every((t) => typeof t === "string")) {
      return NextResponse.json({ error: "teacherIds must be an array of strings" }, { status: 400 });
    }
    syncTeacherIds = teacherIds as string[];
    // Keep legacy teacherId in sync with first teacher (or null)
    updateData.teacherId = syncTeacherIds[0] ?? null;
  } else if (teacherId !== undefined) {
    // Legacy single-teacher assignment
    if (!teacher.isSuperAdmin) {
      return NextResponse.json({ error: "Only the super-admin can assign teachers" }, { status: 403 });
    }
    if (teacherId === null || teacherId === "") {
      updateData.teacherId = null;
      syncTeacherIds = [];
    } else if (typeof teacherId === "string") {
      const assignedTeacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true },
      });
      if (!assignedTeacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }
      updateData.teacherId = teacherId;
      syncTeacherIds = [teacherId];
    } else {
      return NextResponse.json({ error: "Invalid teacher" }, { status: 400 });
    }
  }

  if (level !== undefined) {
    if (level === null || level === "") {
      updateData.level = null;
    } else if (typeof level === "string" && VALID_LEVELS.includes(level)) {
      updateData.level = level;
    } else {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
  }

  if (temporaryPassword !== undefined) {
    if (typeof temporaryPassword !== "string") {
      return NextResponse.json({ error: "Invalid temporary password" }, { status: 400 });
    }
    const pwd = temporaryPassword;
    if (pwd.length < PASSWORD_MIN) {
      return NextResponse.json(
        { error: `Temporary password must be at least ${PASSWORD_MIN} characters` },
        { status: 400 }
      );
    }
    if (pwd.length > PASSWORD_MAX) {
      return NextResponse.json(
        { error: `Temporary password must be at most ${PASSWORD_MAX} characters` },
        { status: 400 }
      );
    }
    updateData.passwordHash = await hashPassword(pwd);
  }

  if (Object.keys(updateData).length === 0 && syncTeacherIds === null) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Validate all teacherIds exist before writing
  if (syncTeacherIds && syncTeacherIds.length > 0) {
    const found = await prisma.teacher.findMany({
      where: { id: { in: syncTeacherIds } },
      select: { id: true },
    });
    if (found.length !== syncTeacherIds.length) {
      return NextResponse.json({ error: "One or more teachers not found" }, { status: 404 });
    }
  }

  // Update student fields
  if (Object.keys(updateData).length > 0) {
    await prisma.student.update({ where: { id }, data: updateData });
  }

  // Sync TeacherStudent join table
  if (syncTeacherIds !== null) {
    await prisma.teacherStudent.deleteMany({ where: { studentId: id } });
    if (syncTeacherIds.length > 0) {
      await prisma.teacherStudent.createMany({
        data: syncTeacherIds.map((tid) => ({ teacherId: tid, studentId: id })),
      });
    }
  }

  const updated = await prisma.student.findUnique({
    where: { id },
    select: studentSelect,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!teacher.isSuperAdmin) {
    return NextResponse.json({ error: "Only the super-admin can delete students" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = (body as Record<string, unknown>)?.id;
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "HomeworkStudentClose" WHERE studentId = ${id}`,
    prisma.$executeRaw`DELETE FROM "HomeworkStudentHide" WHERE studentId = ${id}`,
    prisma.student.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
