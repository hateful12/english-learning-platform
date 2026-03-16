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
        const groupRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT groupId AS groupId FROM "StudentGroup" WHERE studentId = ${studentId}
        `;
        const groupIds = groupRows.map((r) => (r.groupId ?? r.groupid) as string).filter(Boolean);

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

    // Get groupId + group name + per-student close info for all returned homework via raw SQL
    const idList = items.map((i) => i.id);
    type GroupInfoRow = { id: string; groupId: string | null; groupName: string | null };
    let groupInfoMap = new Map<string, { groupId: string | null; groupName: string | null }>();
    // Teacher: map of homeworkId → array of closed studentIds
    let closedForStudentsMap = new Map<string, string[]>();
    // Student: set of homeworkIds individually closed for this student
    let studentClosedSet = new Set<string>();
    // Student: set of homeworkIds hidden by this student (deleted from archive)
    let studentHiddenSet = new Set<string>();

    if (idList.length > 0) {
      const placeholders = idList.map(() => "?").join(", ");

      const groupInfoRows = await prisma.$queryRawUnsafe<GroupInfoRow[]>(
        // Explicit aliases guard against SQLite returning column names in unexpected casing
        `SELECT h.id AS id, h.groupId AS groupId, g.name AS groupName
         FROM "Homework" h
         LEFT JOIN "Group" g ON g.id = h.groupId
         WHERE h.id IN (${placeholders})`,
        ...idList
      );
      for (const row of groupInfoRows) {
        // Defensive: handle both camelCase and lowercase column names from driver
        const rawRow = row as Record<string, unknown>;
        const groupId = (rawRow.groupId ?? rawRow.groupid ?? null) as string | null;
        const groupName = (rawRow.groupName ?? rawRow.groupname ?? null) as string | null;
        groupInfoMap.set(rawRow.id as string, { groupId, groupName });
      }

      if (teacher) {
        // Fetch per-student close records so teacher can see who's closed
        const closeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT homeworkId AS homeworkId, studentId AS studentId FROM "HomeworkStudentClose" WHERE homeworkId IN (${placeholders})`,
          ...idList
        );
        for (const row of closeRows) {
          const hwId = (row.homeworkId ?? row.homeworkid) as string;
          const stId = (row.studentId ?? row.studentid) as string;
          if (!hwId || !stId) continue;
          if (!closedForStudentsMap.has(hwId)) closedForStudentsMap.set(hwId, []);
          closedForStudentsMap.get(hwId)!.push(stId);
        }
      } else if (studentId) {
        // Fetch which of these homeworks are individually closed for this student
        const closeRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT homeworkId AS homeworkId FROM "HomeworkStudentClose" WHERE studentId = ? AND homeworkId IN (${placeholders})`,
          studentId,
          ...idList
        );
        studentClosedSet = new Set(
          closeRows.map((r) => (r.homeworkId ?? r.homeworkid) as string).filter(Boolean)
        );

        // Fetch which of these homeworks the student has hidden from their archive
        const hideRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT homeworkId AS homeworkId FROM "HomeworkStudentHide" WHERE studentId = ? AND homeworkId IN (${placeholders})`,
          studentId,
          ...idList
        );
        studentHiddenSet = new Set(
          hideRows.map((r) => (r.homeworkId ?? r.homeworkid) as string).filter(Boolean)
        );
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

    const visibleItems = teacher
      ? (items as Row[])
      : (items as Row[]).filter((item) => !studentHiddenSet.has(item.id));

    const serialized = visibleItems.map((item) => {
      const { responses, ...rest } = item;
      const gInfo = groupInfoMap.get(item.id);
      // Prefer Prisma's own groupId (reliable once client is regenerated).
      // Fall back to what the raw SQL returned in case the client is still stale.
      const restAny = rest as Record<string, unknown>;
      const groupId: string | null =
        (restAny.groupId as string | null | undefined) ??
        gInfo?.groupId ??
        null;
      return {
        ...rest,
        groupId,
        group: groupId && gInfo?.groupName ? { id: groupId, name: gInfo.groupName } : null,
        // Teacher sees which students have this closed individually
        closedForStudents: teacher ? (closedForStudentsMap.get(item.id) ?? []) : undefined,
        // Student sees whether this homework is individually closed for them
        studentClosed: !teacher ? studentClosedSet.has(item.id) : undefined,
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

    // Auto-close previous active homework only for students who have received teacher feedback
    if (groupId && typeof groupId === "string") {
      // Per-student close: mark closed only for group members whose response already has feedback
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "HomeworkStudentClose" (homeworkId, studentId, closedAt)
        SELECT hr.homeworkId, hr.studentId, datetime('now')
        FROM "HomeworkResponse" hr
        INNER JOIN "Homework" h ON hr.homeworkId = h.id
        WHERE h.groupId = ${groupId} AND h.status = 'active'
          AND hr.teacherFeedback IS NOT NULL AND hr.teacherFeedback != ''
      `;
    } else if (studentId && typeof studentId === "string") {
      // Close individual homework only if the teacher has already given feedback on it
      await prisma.$executeRaw`
        UPDATE "Homework" SET status = 'closed'
        WHERE studentId = ${studentId} AND status = 'active'
          AND EXISTS (
            SELECT 1 FROM "HomeworkResponse"
            WHERE homeworkId = "Homework".id
              AND studentId = ${studentId}
              AND teacherFeedback IS NOT NULL AND teacherFeedback != ''
          )
      `;
    }

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
