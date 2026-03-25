import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTeacherLoggedIn, getStudentId } from "@/lib/auth";
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

export async function GET() {
  try {
    const teacher = await isTeacherLoggedIn();

    if (teacher) {
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
        ORDER BY sl.startAt ASC
      `;

      // Fetch all group members for groups that have lessons
      const groupIds = Array.from(new Set(rows.filter((r) => r.groupId).map((r) => r.groupId as string)));
      type MemberRow = { groupId: string; studentId: string; studentName: string | null; studentEmail: string };
      let allGroupMembers: MemberRow[] = [];
      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => "?").join(",");
        allGroupMembers = await prisma.$queryRawUnsafe<MemberRow[]>(
          `SELECT sg.groupId, sg.studentId, s.name AS studentName, s.email AS studentEmail
           FROM "StudentGroup" sg
           JOIN "Student" s ON s.id = sg.studentId
           WHERE sg.groupId IN (${placeholders})`,
          ...groupIds
        );
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
      if (groupLessonIds.length > 0) {
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

    const studentId = await getStudentId();
    if (!studentId) return NextResponse.json([], { status: 401 });

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
    const loggedIn = await isTeacherLoggedIn();
    if (!loggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

    const baseStart = new Date(startAt as string);
    const occurrences = typeof repeatCount === "number" && repeatCount > 1 ? repeatCount : 1;
    const intervalDays = typeof repeatDays === "number" && repeatDays > 0 ? repeatDays : 0;

    // If this is a group lesson, get the group members to pre-create GroupLessonPayment rows
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
        const gpRows = groupMemberIds.length > 0
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
        created.push(formatLesson(rows[0], true, gId ? gp : undefined));
      }
    }

    return NextResponse.json(created.length === 1 ? created[0] : created);
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
