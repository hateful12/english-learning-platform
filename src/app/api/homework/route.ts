import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";

export async function GET() {
  try {
    const teacher = await isTeacherLoggedIn();
    const studentId = teacher ? null : await getStudentId();

    let matchingIds: string[] | null = null; // null = fetch all (teacher)

    if (!teacher) {
      if (studentId) {
        // Find all groups the student belongs to via raw SQL
        const groupRows = await prisma.$queryRaw<Array<{ groupId: string }>>`
          SELECT groupId FROM "StudentGroup" WHERE studentId = ${studentId}
        `;
        const groupIds = groupRows.map((r) => r.groupId);

        // Build matching homework IDs: all-students OR individual OR group
        let rows: Array<{ id: string }>;
        if (groupIds.length > 0) {
          const placeholders = groupIds.map(() => "?").join(", ");
          rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM "Homework" WHERE (studentId IS NULL AND groupId IS NULL) OR studentId = ? OR groupId IN (${placeholders})`,
            studentId,
            ...groupIds
          );
        } else {
          rows = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Homework" WHERE (studentId IS NULL AND groupId IS NULL) OR studentId = ${studentId}
          `;
        }
        matchingIds = rows.map((r) => r.id);
      } else {
        // Unauthenticated: only truly public homework (no student, no group)
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Homework" WHERE studentId IS NULL AND groupId IS NULL
        `;
        matchingIds = rows.map((r) => r.id);
      }
    }

    const items = await prisma.homework.findMany({
      where: matchingIds !== null ? { id: { in: matchingIds } } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        ...(teacher
          ? { responses: { include: { student: { select: { id: true, email: true, name: true } } } } }
          : studentId
            ? { responses: { where: { studentId } } }
            : {}),
      },
    });

    // Get groupId + group name for all returned homework via raw SQL
    const idList = items.map((i) => i.id);
    type GroupInfoRow = { id: string; groupId: string | null; groupName: string | null };
    let groupInfoMap = new Map<string, { groupId: string | null; groupName: string | null }>();

    if (idList.length > 0) {
      const placeholders = idList.map(() => "?").join(", ");
      const groupInfoRows = await prisma.$queryRawUnsafe<GroupInfoRow[]>(
        `SELECT h.id, h.groupId, g.name AS groupName
         FROM "Homework" h
         LEFT JOIN "Group" g ON g.id = h.groupId
         WHERE h.id IN (${placeholders})`,
        ...idList
      );
      for (const row of groupInfoRows) {
        groupInfoMap.set(row.id, { groupId: row.groupId, groupName: row.groupName });
      }
    }

    type Row = (typeof items)[number] & {
      responses?: Array<{
        id: string;
        response: string;
        submittedAt: Date;
        teacherFeedback?: string | null;
        teacherFeedbackAttachments?: string;
        feedbackAt?: Date | null;
        student?: { id: string; email: string; name: string | null };
      }>;
    };

    const serialized = (items as Row[]).map((item) => {
      const { responses, ...rest } = item;
      const gInfo = groupInfoMap.get(item.id);
      return {
        ...rest,
        groupId: gInfo?.groupId ?? null,
        group: gInfo?.groupId && gInfo?.groupName ? { id: gInfo.groupId, name: gInfo.groupName } : null,
        responses:
          responses && Array.isArray(responses)
            ? responses.map((r) => ({
                id: r.id,
                response: r.response,
                submittedAt: r.submittedAt,
                teacherFeedback: r.teacherFeedback ?? null,
                teacherFeedbackAttachments: r.teacherFeedbackAttachments ?? "[]",
                feedbackAt: r.feedbackAt ?? null,
                ...(r.student ? { student: r.student } : {}),
              }))
            : [],
      };
    });

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("GET /api/homework error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load homework", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
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
    const { title, description, studentId, groupId, attachments } = (body as Record<string, unknown>) ?? {};
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    const attachmentsJson =
      Array.isArray(attachments) && attachments.every((a: unknown) => a && typeof (a as { url?: string }).url === "string")
        ? JSON.stringify(attachments)
        : "[]";

    // Create without groupId first (old client doesn't know the field)
    const item = await prisma.homework.create({
      data: {
        title,
        description: (description as string) ?? "",
        attachments: attachmentsJson,
        studentId: studentId && typeof studentId === "string" ? studentId : null,
      },
    });

    // Set groupId via raw SQL if provided
    if (groupId && typeof groupId === "string") {
      await prisma.$executeRaw`UPDATE "Homework" SET groupId = ${groupId} WHERE id = ${item.id}`;
    }

    return NextResponse.json({ ...item, groupId: (groupId as string) || null });
  } catch (err) {
    console.error("POST /api/homework error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to create homework", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
