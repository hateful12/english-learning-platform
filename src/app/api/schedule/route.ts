import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId, getTeacherSession, teacherCanAccessStudent } from "@/lib/auth";
import { randomUUID } from "crypto";

type LessonRow = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  zoomUrl: string | null;
  notes: string | null;
  studentId: string | null;
  groupId: string | null;
  isPaid: number | boolean;
  // for student queries: per-student isPaid from GroupLessonPayment (nullable when no record yet)
  glp_isPaid: number | boolean | null;
  createdAt: string;
  s_id: string | null;
  s_email: string | null;
  s_name: string | null;
  g_id: string | null;
  g_name: string | null;
};

type GroupPaymentRow = {
  lessonId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  isPaid: number | boolean;
  paymentId: string | null;
};

function formatLesson(
  row: LessonRow,
  isTeacher: boolean,
  groupPayments?: Array<{ studentId: string; name: string | null; email: string; isPaid: boolean; paymentId: string | null }>
) {
  // For group lessons viewed by a student, use GroupLessonPayment.isPaid
  // For individual lessons, use ScheduledLesson.isPaid
  const isPaid = row.groupId && !isTeacher
    ? Boolean(row.glp_isPaid)
    : Boolean(row.isPaid);

  return {
    id: row.id,
    title: row.title,
    startAt: row.startAt,
    durationMin: row.durationMin,
    zoomUrl: isTeacher || isPaid ? row.zoomUrl : null,
    notes: row.notes,
    studentId: row.studentId,
    groupId: row.groupId,
    isPaid,
    createdAt: row.createdAt,
    student: row.s_id ? { id: row.s_id, email: row.s_email, name: row.s_name } : null,
    group: row.g_id ? { id: row.g_id, name: row.g_name } : null,
    ...(isTeacher && groupPayments ? { groupPayments } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    // ── Session routing ──────────────────────────────────────────────────────
    // The teacher dashboard explicitly sends ?view=teacher. Anything else
    // (including a student browser that happens to also carry a stale teacher
    // cookie) is treated as a student request so that students never see other
    // students' schedules.
    const url = new URL(request.url);
    const wantTeacherView = url.searchParams.get("view") === "teacher";

    const teacher = wantTeacherView ? await getTeacherSession() : null;

    if (teacher) {
      const rows = teacher.isSuperAdmin
        ? await prisma.$queryRaw<LessonRow[]>`
            SELECT
              sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
              sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
              NULL AS glp_isPaid,
              s.id    AS s_id,
              s.email AS s_email,
              s.name  AS s_name,
              g.id    AS g_id,
              g.name  AS g_name
            FROM "ScheduledLesson" sl
            LEFT JOIN "Student" s ON s.id = sl.studentId
            LEFT JOIN "Group"   g ON g.id = sl.groupId
            ORDER BY sl.startAt ASC
          `
        : await prisma.$queryRaw<LessonRow[]>`
            SELECT
              sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
              sl.studentId, sl.groupId, 0 AS isPaid, sl.createdAt,
              NULL AS glp_isPaid,
              s.id    AS s_id,
              s.email AS s_email,
              s.name  AS s_name,
              g.id    AS g_id,
              g.name  AS g_name
            FROM "ScheduledLesson" sl
            LEFT JOIN "Student" s ON s.id = sl.studentId
            LEFT JOIN "Group"   g ON g.id = sl.groupId
            WHERE s.teacherId = ${teacher.id}
               OR g.teacherId = ${teacher.id}
               OR EXISTS (
                 SELECT 1
                 FROM "StudentGroup" sg2
                 JOIN "Student" s2 ON s2.id = sg2.studentId
                 WHERE sg2.groupId = sl.groupId AND s2.teacherId = ${teacher.id}
               )
            ORDER BY sl.startAt ASC
          `;

      // Fetch all group members for groups that have lessons
      const groupIds = Array.from(new Set(rows.filter((r) => r.groupId).map((r) => r.groupId as string)));
      type MemberRow = { groupId: string; studentId: string; studentName: string | null; studentEmail: string };
      let allGroupMembers: MemberRow[] = [];
      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => "?").join(",");
        if (teacher.isSuperAdmin) {
          allGroupMembers = await prisma.$queryRawUnsafe<MemberRow[]>(
            `SELECT sg.groupId, sg.studentId, s.name AS studentName, s.email AS studentEmail
             FROM "StudentGroup" sg
             JOIN "Student" s ON s.id = sg.studentId
             WHERE sg.groupId IN (${placeholders})`,
            ...groupIds
          );
        } else {
          allGroupMembers = await prisma.$queryRawUnsafe<MemberRow[]>(
            `SELECT sg.groupId, sg.studentId, s.name AS studentName, s.email AS studentEmail
             FROM "StudentGroup" sg
             JOIN "Student" s ON s.id = sg.studentId
             WHERE sg.groupId IN (${placeholders}) AND s.teacherId = ?`,
            ...groupIds,
            teacher.id
          );
        }
      }
      // Index members by groupId
      const membersByGroup = new Map<string, MemberRow[]>();
      for (const m of allGroupMembers) {
        if (!membersByGroup.has(m.groupId)) membersByGroup.set(m.groupId, []);
        membersByGroup.get(m.groupId)!.push(m);
      }

      // Fetch GroupLessonPayment records for all group lessons
      const groupLessonIds = rows.filter((r) => r.groupId).map((r) => r.id);
      let groupPaymentRows: GroupPaymentRow[] = [];
      if (teacher.isSuperAdmin && groupLessonIds.length > 0) {
        const placeholders = groupLessonIds.map(() => "?").join(",");
        groupPaymentRows = await prisma.$queryRawUnsafe<GroupPaymentRow[]>(
          `SELECT glp.lessonId, glp.studentId, glp.isPaid, glp.paymentId,
                  s.name AS studentName, s.email AS studentEmail
           FROM "GroupLessonPayment" glp
           JOIN "Student" s ON s.id = glp.studentId
           WHERE glp.lessonId IN (${placeholders})`,
          ...groupLessonIds
        );
      }

      // Index payment rows by lessonId + studentId
      const paymentByLessonStudent = new Map<string, GroupPaymentRow>();
      for (const gpr of groupPaymentRows) {
        paymentByLessonStudent.set(`${gpr.lessonId}:${gpr.studentId}`, gpr);
      }

      return NextResponse.json(
        rows.map((r) => {
          if (!r.groupId) return formatLesson(r, true);
          if (!teacher.isSuperAdmin) return formatLesson(r, true);
          // Merge all group members with their payment status (default: unpaid)
          const members = membersByGroup.get(r.groupId) ?? [];
          const gp = members.map((m) => {
            const existing = paymentByLessonStudent.get(`${r.id}:${m.studentId}`);
            return {
              studentId: m.studentId,
              name: m.studentName,
              email: m.studentEmail,
              isPaid: existing ? Boolean(existing.isPaid) : false,
              paymentId: existing?.paymentId ?? null,
            };
          });
          return formatLesson(r, true, gp);
        })
      );
    }

    // No ?view=teacher — try student session first
    const studentId = await getStudentId();

    // Fallback: if no student session but a teacher session exists (e.g. teacher
    // navigates to / without a student account), still return their teacher view
    // rather than a 401.  This keeps backward-compat for any direct API usage.
    if (!studentId) {
      const fallbackTeacher = await getTeacherSession();
      if (!fallbackTeacher) return NextResponse.json([], { status: 401 });

      // Re-use the teacher path with the fallback session
      const rows = fallbackTeacher.isSuperAdmin
        ? await prisma.$queryRaw<LessonRow[]>`
            SELECT
              sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
              sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
              NULL AS glp_isPaid,
              s.id    AS s_id,
              s.email AS s_email,
              s.name  AS s_name,
              g.id    AS g_id,
              g.name  AS g_name
            FROM "ScheduledLesson" sl
            LEFT JOIN "Student" s ON s.id = sl.studentId
            LEFT JOIN "Group"   g ON g.id = sl.groupId
            ORDER BY sl.startAt ASC
          `
        : await prisma.$queryRaw<LessonRow[]>`
            SELECT
              sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
              sl.studentId, sl.groupId, 0 AS isPaid, sl.createdAt,
              NULL AS glp_isPaid,
              s.id    AS s_id,
              s.email AS s_email,
              s.name  AS s_name,
              g.id    AS g_id,
              g.name  AS g_name
            FROM "ScheduledLesson" sl
            LEFT JOIN "Student" s ON s.id = sl.studentId
            LEFT JOIN "Group"   g ON g.id = sl.groupId
            WHERE s.teacherId = ${fallbackTeacher.id}
               OR g.teacherId = ${fallbackTeacher.id}
               OR EXISTS (
                 SELECT 1
                 FROM "StudentGroup" sg2
                 JOIN "Student" s2 ON s2.id = sg2.studentId
                 WHERE sg2.groupId = sl.groupId AND s2.teacherId = ${fallbackTeacher.id}
               )
            ORDER BY sl.startAt ASC
          `;
      return NextResponse.json(rows.map((r) => formatLesson(r, true)));
    }

    const groupRows = await prisma.$queryRaw<{ groupId: string }[]>`
      SELECT groupId FROM "StudentGroup" WHERE studentId = ${studentId}
    `;
    const groupIds = groupRows.map((r) => r.groupId);

    let rows: LessonRow[];
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => "?").join(",");
      rows = await prisma.$queryRawUnsafe<LessonRow[]>(
        `SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          glp.isPaid AS glp_isPaid,
          g.id   AS g_id,
          g.name AS g_name,
          NULL AS s_id, NULL AS s_email, NULL AS s_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Group" g ON g.id = sl.groupId
        LEFT JOIN "GroupLessonPayment" glp ON glp.lessonId = sl.id AND glp.studentId = ?
        WHERE sl.studentId = ? OR sl.groupId IN (${placeholders})
        ORDER BY sl.startAt ASC`,
        studentId,
        studentId,
        ...groupIds
      );
    } else {
      rows = await prisma.$queryRaw<LessonRow[]>`
        SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          NULL AS glp_isPaid,
          g.id   AS g_id,
          g.name AS g_name,
          NULL AS s_id, NULL AS s_email, NULL AS s_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Group" g ON g.id = sl.groupId
        WHERE sl.studentId = ${studentId}
        ORDER BY sl.startAt ASC
      `;
    }

    return NextResponse.json(rows.map((r) => formatLesson(r, false)));
  } catch (err) {
    console.error("GET /api/schedule error:", err);
    return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await getTeacherSession();
    if (!teacher) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // ── Reschedule action ──────────────────────────────────────────────────────
    // Deletes all future unpaid lessons from `deleteFrom` for a student/group,
    // then bulk-creates a new series starting at `startAt`.
    if ((body as Record<string, unknown>)?.action === "reschedule") {
      const {
        studentId: rsStudentId,
        groupId: rsGroupId,
        deleteFrom,
        startAt: rsStartAt,
        title: rsTitle,
        durationMin: rsDuration,
        zoomUrl: rsZoomUrl,
        notes: rsNotes,
        repeatDays: rsRepeatDays,
        repeatCount: rsRepeatCount,
      } = body as Record<string, unknown>;

      const sId = rsStudentId && typeof rsStudentId === "string" ? rsStudentId : null;
      const gId = rsGroupId && typeof rsGroupId === "string" ? rsGroupId : null;
      if (!sId && !gId) return NextResponse.json({ error: "studentId or groupId required" }, { status: 400 });
      if (!rsStartAt) return NextResponse.json({ error: "startAt required" }, { status: 400 });
      if (!rsTitle || typeof rsTitle !== "string" || !rsTitle.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

      if (sId && !(await teacherCanAccessStudent(teacher, sId))) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      const deleteFromIso = deleteFrom && typeof deleteFrom === "string"
        ? new Date(deleteFrom).toISOString()
        : new Date().toISOString();

      // Delete future unpaid lessons from deleteFrom date
      let deletedCount = 0;
      if (sId) {
        const toDelete = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "ScheduledLesson"
          WHERE studentId = ${sId} AND isPaid = 0 AND startAt >= ${deleteFromIso}
        `;
        deletedCount = toDelete.length;
        for (const row of toDelete) {
          await prisma.$executeRaw`DELETE FROM "ScheduledLesson" WHERE id = ${row.id}`;
        }
      } else if (gId) {
        const toDelete = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "ScheduledLesson"
          WHERE groupId = ${gId} AND startAt >= ${deleteFromIso}
          AND NOT EXISTS (
            SELECT 1 FROM "GroupLessonPayment" glp WHERE glp.lessonId = "ScheduledLesson".id AND glp.isPaid = 1
          )
        `;
        deletedCount = toDelete.length;
        for (const row of toDelete) {
          await prisma.$executeRaw`DELETE FROM "ScheduledLesson" WHERE id = ${row.id}`;
        }
      }

      // Create new lessons (reuse same logic as regular bulk create)
      const dur = typeof rsDuration === "number" ? rsDuration : 60;
      const zoom = rsZoomUrl && typeof rsZoomUrl === "string" ? rsZoomUrl.trim() || null : null;
      const notesVal = rsNotes && typeof rsNotes === "string" ? rsNotes.trim() || null : null;
      const occurrences = typeof rsRepeatCount === "number" && rsRepeatCount > 1 ? rsRepeatCount : 1;
      const intervalDays = typeof rsRepeatDays === "number" && rsRepeatDays > 0 ? rsRepeatDays : 7;
      const baseStart = new Date(rsStartAt as string);

      let groupMemberIds: string[] = [];
      if (gId) {
        const members = await prisma.$queryRaw<{ studentId: string }[]>`
          SELECT studentId FROM "StudentGroup" WHERE groupId = ${gId}
        `;
        groupMemberIds = members.map((m) => m.studentId);
      }

      const created: ReturnType<typeof formatLesson>[] = [];
      for (let i = 0; i < occurrences; i++) {
        const start = new Date(baseStart.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
        const id = randomUUID().replace(/-/g, "");
        const now = new Date().toISOString();
        const startISO = start.toISOString();
        await prisma.$executeRaw`
          INSERT INTO "ScheduledLesson" (id, title, startAt, durationMin, zoomUrl, notes, studentId, groupId, isPaid, createdAt)
          VALUES (${id}, ${rsTitle.toString().trim()}, ${startISO}, ${dur}, ${zoom}, ${notesVal}, ${sId}, ${gId}, 0, ${now})
        `;
        for (const memberId of groupMemberIds) {
          await prisma.$executeRaw`INSERT OR IGNORE INTO "GroupLessonPayment" (studentId, lessonId, isPaid) VALUES (${memberId}, ${id}, 0)`;
        }
        const rows = await prisma.$queryRaw<LessonRow[]>`
          SELECT sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
                 sl.studentId, sl.groupId, sl.isPaid, sl.createdAt, NULL AS glp_isPaid,
                 s.id AS s_id, s.email AS s_email, s.name AS s_name,
                 g.id AS g_id, g.name AS g_name
          FROM "ScheduledLesson" sl
          LEFT JOIN "Student" s ON s.id = sl.studentId
          LEFT JOIN "Group"   g ON g.id = sl.groupId
          WHERE sl.id = ${id}
        `;
        if (rows[0]) created.push(formatLesson(rows[0], true, undefined));
      }

      return NextResponse.json({ deleted: deletedCount, created: created.length, lessons: created });
    }

    const {
      title, startAt, durationMin, zoomUrl, notes, studentId, groupId,
      repeatDays, repeatCount,
    } = (body as Record<string, unknown>) ?? {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!startAt) {
      return NextResponse.json({ error: "startAt is required" }, { status: 400 });
    }

    const dur = typeof durationMin === "number" ? durationMin : 60;
    const zoom = zoomUrl && typeof zoomUrl === "string" ? zoomUrl.trim() || null : null;
    const notesVal = notes && typeof notes === "string" ? notes.trim() || null : null;
    const sId = studentId && typeof studentId === "string" ? studentId : null;
    const gId = groupId && typeof groupId === "string" ? groupId : null;

    if (sId && !(await teacherCanAccessStudent(teacher, sId))) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (gId && !teacher.isSuperAdmin) {
      const accessRows = await prisma.$queryRaw<Array<{ ok: number }>>`
        SELECT COUNT(*) AS ok
        FROM "Group" g
        WHERE g.id = ${gId}
          AND (
            g.teacherId = ${teacher.id}
            OR EXISTS (
              SELECT 1
              FROM "StudentGroup" sg
              JOIN "Student" s ON s.id = sg.studentId
              WHERE sg.groupId = g.id AND s.teacherId = ${teacher.id}
            )
          )
      `;
      if (Number(accessRows[0]?.ok ?? 0) === 0) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    const baseStart = new Date(startAt as string);
    const occurrences = typeof repeatCount === "number" && repeatCount > 1 ? repeatCount : 1;
    const intervalDays = typeof repeatDays === "number" && repeatDays > 0 ? repeatDays : 0;

    // If this is a group lesson, get the group members to pre-create GroupLessonPayment rows
    let groupMemberIds: string[] = [];
    if (gId) {
      const members = teacher.isSuperAdmin
        ? await prisma.$queryRaw<{ studentId: string }[]>`
            SELECT studentId FROM "StudentGroup" WHERE groupId = ${gId}
          `
        : await prisma.$queryRaw<{ studentId: string }[]>`
            SELECT sg.studentId
            FROM "StudentGroup" sg
            JOIN "Student" s ON s.id = sg.studentId
            WHERE sg.groupId = ${gId} AND s.teacherId = ${teacher.id}
          `;
      groupMemberIds = members.map((m) => m.studentId);
    }

    const created: ReturnType<typeof formatLesson>[] = [];

    for (let i = 0; i < occurrences; i++) {
      const start = new Date(baseStart.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
      const id = randomUUID().replace(/-/g, "");
      const now = new Date().toISOString();
      const startISO = start.toISOString();

      await prisma.$executeRaw`
        INSERT INTO "ScheduledLesson" (id, title, startAt, durationMin, zoomUrl, notes, studentId, groupId, isPaid, createdAt)
        VALUES (${id}, ${title.trim()}, ${startISO}, ${dur}, ${zoom}, ${notesVal}, ${sId}, ${gId}, 0, ${now})
      `;

      // Pre-create GroupLessonPayment records for each group member
      for (const memberId of groupMemberIds) {
        await prisma.$executeRaw`
          INSERT OR IGNORE INTO "GroupLessonPayment" (studentId, lessonId, isPaid)
          VALUES (${memberId}, ${id}, 0)
        `;
      }

      const rows = await prisma.$queryRaw<LessonRow[]>`
        SELECT
          sl.id, sl.title, sl.startAt, sl.durationMin, sl.zoomUrl, sl.notes,
          sl.studentId, sl.groupId, sl.isPaid, sl.createdAt,
          NULL AS glp_isPaid,
          s.id    AS s_id,
          s.email AS s_email,
          s.name  AS s_name,
          g.id    AS g_id,
          g.name  AS g_name
        FROM "ScheduledLesson" sl
        LEFT JOIN "Student" s ON s.id = sl.studentId
        LEFT JOIN "Group"   g ON g.id = sl.groupId
        WHERE sl.id = ${id}
      `;
      if (rows[0]) {
        const gpRows = teacher.isSuperAdmin && groupMemberIds.length > 0
          ? await prisma.$queryRaw<GroupPaymentRow[]>`
              SELECT glp.lessonId, glp.studentId, glp.isPaid, glp.paymentId,
                     s.name AS studentName, s.email AS studentEmail
              FROM "GroupLessonPayment" glp
              JOIN "Student" s ON s.id = glp.studentId
              WHERE glp.lessonId = ${id}
            `
          : [];
        const gp = gpRows.map((g) => ({
          studentId: g.studentId,
          name: g.studentName,
          email: g.studentEmail,
          isPaid: Boolean(g.isPaid),
          paymentId: g.paymentId,
        }));
        created.push(formatLesson(rows[0], true, teacher.isSuperAdmin && gId ? gp : undefined));
      }
    }

    return NextResponse.json(created.length === 1 ? created[0] : created);
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
