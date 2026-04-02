import { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { getHomeworkReminderTimezone, reminderUtcBeforeLesson } from "@/lib/homework-reminder-time";

const APP_URL_KEY = "app_url";

async function getAppBaseUrl(): Promise<string> {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const row = await prisma.settings.findUnique({ where: { key: APP_URL_KEY } });
  return row?.value?.trim().replace(/\/$/, "") ?? "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function collectStudentIdsForHomework(args: {
  studentId: string | null;
  groupId: string | null;
}): Promise<string[]> {
  if (args.studentId) return [args.studentId];
  if (args.groupId) {
    const rows = await prisma.studentGroup.findMany({
      where: { groupId: args.groupId },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }
  const all = await prisma.student.findMany({ select: { id: true } });
  return all.map((s) => s.id);
}

export async function findNextLessonForStudent(
  studentId: string
): Promise<{ id: string; startAt: Date } | null> {
  const now = new Date();
  const groupRows = await prisma.studentGroup.findMany({
    where: { studentId },
    select: { groupId: true },
  });
  const groupIds = groupRows.map((r) => r.groupId);

  const [individual, groupLesson] = await Promise.all([
    prisma.scheduledLesson.findFirst({
      where: { studentId, startAt: { gt: now } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true },
    }),
    groupIds.length
      ? prisma.scheduledLesson.findFirst({
          where: { groupId: { in: groupIds }, startAt: { gt: now } },
          orderBy: { startAt: "asc" },
          select: { id: true, startAt: true },
        })
      : Promise.resolve(null),
  ]);

  if (!individual && !groupLesson) return null;
  if (!individual) return groupLesson;
  if (!groupLesson) return individual;
  return individual.startAt <= groupLesson.startAt ? individual : groupLesson;
}

/** Called when the teacher creates homework; skips students with no upcoming lesson. */
export async function scheduleRemindersForNewHomework(
  homeworkId: string,
  studentId: string | null,
  groupId: string | null
): Promise<void> {
  const tz = getHomeworkReminderTimezone();
  const targetIds = await collectStudentIdsForHomework({ studentId, groupId });
  if (targetIds.length === 0) return;

  const rows: Array<{
    homeworkId: string;
    studentId: string;
    scheduledAt: Date;
    lessonId: string;
  }> = [];

  for (const sid of targetIds) {
    const lesson = await findNextLessonForStudent(sid);
    if (!lesson) continue;
    const scheduledAt = reminderUtcBeforeLesson(lesson.startAt, tz);
    rows.push({
      homeworkId,
      studentId: sid,
      scheduledAt,
      lessonId: lesson.id,
    });
  }

  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      await prisma.homeworkReminder.create({ data: row });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}

export async function sendDueHomeworkReminders(limit = 30): Promise<{ sent: number; failed: number }> {
  const baseUrl = await getAppBaseUrl();
  const tz = getHomeworkReminderTimezone();
  const now = new Date();

  const due = await prisma.homeworkReminder.findMany({
    where: { sentAt: null, scheduledAt: { lte: now } },
    include: {
      student: { select: { email: true, name: true } },
      homework: { select: { title: true } },
    },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });

  let sent = 0;
  let failed = 0;

  for (const r of due) {
    let lessonFmt = "your upcoming lesson";
    if (r.lessonId) {
      const lesson = await prisma.scheduledLesson.findUnique({
        where: { id: r.lessonId },
        select: { startAt: true },
      });
      if (lesson?.startAt) {
        lessonFmt = formatInTimeZone(lesson.startAt, tz, "EEE, d MMM yyyy HH:mm");
      }
    }

    const name = r.student.name || "there";
    const link = baseUrl ? `${baseUrl}/` : "";
    const html = `
      <p>Hi ${escapeHtml(name)},</p>
      <p>This is a reminder about your homework <strong>${escapeHtml(r.homework.title)}</strong> before ${escapeHtml(lessonFmt)}.</p>
      ${link ? `<p><a href="${escapeHtml(link)}">Open the app</a></p>` : ""}
      <p>— Your teacher</p>
    `.trim();

    const result = await sendTransactionalEmail({
      to: r.student.email,
      subject: `Homework reminder: ${r.homework.title}`,
      html,
    });

    if (result.ok) {
      await prisma.homeworkReminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      sent++;
    } else {
      console.error("[homework-reminder] send failed", r.id, result.error);
      failed++;
    }
  }

  return { sent, failed };
}
