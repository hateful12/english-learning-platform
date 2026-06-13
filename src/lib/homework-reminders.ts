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

const DESC_PREVIEW_CHARS = 8000;

type HwAttachment = { url?: string; name?: string; type?: string };

function parseHomeworkAttachmentsJson(raw: string): HwAttachment[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function absoluteAssetUrl(baseUrl: string, path: string): string {
  const p = (path || "").trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const b = baseUrl.replace(/\/$/, "");
  return `${b}${p.startsWith("/") ? p : `/${p}`}`;
}

/** Opens student dashboard on Homework tab, scrolled to this task. */
function homeworkTabDeepLink(baseUrl: string, homeworkId: string): string {
  const b = baseUrl.replace(/\/$/, "");
  return `${b}/?tab=homework&hw=${encodeURIComponent(homeworkId)}`;
}

function loginThenHomeworkLink(baseUrl: string, homeworkId: string): string {
  const b = baseUrl.replace(/\/$/, "");
  const next = `/?tab=homework&hw=${encodeURIComponent(homeworkId)}`;
  return `${b}/login?next=${encodeURIComponent(next)}`;
}

function buildHomeworkEmailHtml(opts: {
  studentName: string;
  description: string;
  homeworkId: string;
  baseUrl: string;
  attachmentsJson: string;
  /** First content block after greeting (include title inside if needed). */
  leadHtml: string;
}): string {
  const desc = opts.description.trim();
  const snippet = desc.length > DESC_PREVIEW_CHARS ? `${desc.slice(0, DESC_PREVIEW_CHARS)}…` : desc;
  const atts = parseHomeworkAttachmentsJson(opts.attachmentsJson);
  const abs = (u: string) => absoluteAssetUrl(opts.baseUrl, u);

  let attachmentsBlock = "";
  if (atts.length > 0) {
    const parts = atts.map((a) => {
      const url = abs(a.url || "");
      const name = escapeHtml(a.name || "attachment");
      if (!url) return `<p>📎 ${name}</p>`;
      if (a.type === "image") {
        return `<p style="margin:12px 0"><span style="font-size:13px;color:#444">${name}</span><br/><a href="${escapeHtml(url)}" style="text-decoration:none"><img src="${escapeHtml(url)}" alt="" width="560" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e7eb"/></a></p>`;
      }
      return `<p>📎 <a href="${escapeHtml(url)}">${name}</a></p>`;
    });
    attachmentsBlock = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
      <p style="font-size:13px;color:#666;margin:0 0 8px">Attachments (${atts.length})</p>
      ${parts.join("")}`;
  }

  const hasBase = Boolean(opts.baseUrl);
  const openHw = hasBase ? homeworkTabDeepLink(opts.baseUrl, opts.homeworkId) : "";
  const signIn = hasBase ? loginThenHomeworkLink(opts.baseUrl, opts.homeworkId) : "";

  const actions = hasBase
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr>
        <td><a href="${escapeHtml(openHw)}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open in Homework tab</a></td>
      </tr></table>
      <p style="font-size:12px;color:#888;margin:0 0 8px">Direct link (copy if the button does not work):<br/>
      <a href="${escapeHtml(openHw)}" style="word-break:break-all;color:#0d9488">${escapeHtml(openHw)}</a></p>
      <p style="font-size:12px;color:#888;margin:0">Not signed in? <a href="${escapeHtml(signIn)}" style="color:#0d9488">Log in</a> — you will return to this homework.</p>`
    : "";

  return `
    <p>Hi ${escapeHtml(opts.studentName)},</p>
    ${opts.leadHtml}
    ${snippet ? `<div style="margin-top:14px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Preview</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#374151;white-space:pre-wrap">${escapeHtml(snippet).replace(/\n/g, "<br/>")}</p>
    </div>` : ""}
    ${attachmentsBlock}
    ${actions}
    <p style="margin-top:24px">— Your teacher</p>
  `.trim();
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

/** Immediate email when homework is assigned (separate from the pre-lesson reminder). */
export async function notifyStudentsNewHomework(args: {
  homeworkId: string;
  title: string;
  description: string;
  attachmentsJson: string;
  studentId: string | null;
  groupId: string | null;
  /** If set, replaces the default “You have new homework…” intro. */
  leadHtml?: string;
}): Promise<{ recipientCount: number; sent: number; failed: number; firstError?: string }> {
  const ids = await collectStudentIdsForHomework({
    studentId: args.studentId,
    groupId: args.groupId,
  });
  if (ids.length === 0) return { recipientCount: 0, sent: 0, failed: 0 };

  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true },
  });

  const baseUrl = await getAppBaseUrl();
  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;

  const lead =
    args.leadHtml ??
    `<p>You have new homework: <strong>${escapeHtml(args.title)}</strong>.</p>`;

  for (const s of students) {
    const name = s.name || "there";
    const html = buildHomeworkEmailHtml({
      studentName: name,
      description: args.description,
      homeworkId: args.homeworkId,
      baseUrl,
      attachmentsJson: args.attachmentsJson,
      leadHtml: lead,
    });

    const subject =
      args.leadHtml !== undefined ? `Homework: ${args.title}` : `New homework: ${args.title}`;

    const result = await sendTransactionalEmail({
      to: s.email,
      subject,
      html,
    });
    if (result.ok) {
      sent++;
    } else {
      failed++;
      if (!firstError) firstError = result.error;
      console.error("[homework-notify-email] failed", s.id, s.email, result.error);
    }
  }

  return { recipientCount: students.length, sent, failed, ...(firstError ? { firstError } : {}) };
}

/** Load homework from DB and send the same notification email as on create (for manual “Notify” from teacher UI). */
export async function notifyHomeworkById(
  homeworkId: string
): Promise<
  | { ok: true; recipientCount: number; sent: number; failed: number; firstError?: string }
  | { ok: false; error: string }
> {
  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: {
      id: true,
      title: true,
      description: true,
      attachments: true,
      studentId: true,
      groupId: true,
    },
  });
  if (!hw) return { ok: false, error: "Homework not found" };

  const stats = await notifyStudentsNewHomework({
    homeworkId: hw.id,
    title: hw.title,
    description: hw.description,
    attachmentsJson: hw.attachments || "[]",
    studentId: hw.studentId,
    groupId: hw.groupId,
    leadHtml: `<p>Your teacher asked us to send you this homework again: <strong>${escapeHtml(hw.title)}</strong>.</p>`,
  });

  if (stats.recipientCount === 0) {
    return { ok: false, error: "No students are assigned to this homework" };
  }

  return { ok: true, ...stats };
}

/** Email student when the teacher leaves feedback on their homework response. */
export async function sendFeedbackNotification(args: {
  responseId: string;
  teacherFeedback: string;
}): Promise<void> {
  try {
    const response = await prisma.homeworkResponse.findUnique({
      where: { id: args.responseId },
      select: {
        student: { select: { email: true, name: true } },
        homework: { select: { id: true, title: true } },
        teacherFeedbackAttachments: true,
      },
    });
    if (!response) return;

    const baseUrl = await getAppBaseUrl();
    const studentName = response.student.name || "there";
    const hwTitle = response.homework.title;
    const feedback = args.teacherFeedback.trim();
    const PREVIEW_CHARS = 1200;
    const preview = feedback.length > PREVIEW_CHARS ? `${feedback.slice(0, PREVIEW_CHARS)}…` : feedback;

    const atts = parseHomeworkAttachmentsJson(response.teacherFeedbackAttachments ?? "[]");
    const abs = (u: string) => absoluteAssetUrl(baseUrl, u);
    let attachmentsBlock = "";
    if (atts.length > 0) {
      const parts = atts.map((a) => {
        const url = abs(a.url || "");
        const name = escapeHtml(a.name || "attachment");
        if (!url) return `<p>📎 ${name}</p>`;
        if (a.type === "image") {
          return `<p style="margin:12px 0"><a href="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="" width="560" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e7eb"/></a></p>`;
        }
        return `<p>📎 <a href="${escapeHtml(url)}">${name}</a></p>`;
      });
      attachmentsBlock = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
        <p style="font-size:13px;color:#666;margin:0 0 8px">Attachments from teacher (${atts.length})</p>
        ${parts.join("")}`;
    }

    const openHw = baseUrl ? homeworkTabDeepLink(baseUrl, response.homework.id) : "";
    const signIn = baseUrl ? loginThenHomeworkLink(baseUrl, response.homework.id) : "";
    const actions = openHw
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr>
          <td><a href="${escapeHtml(openHw)}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open homework</a></td>
        </tr></table>
        <p style="font-size:12px;color:#888;margin:0 0 8px">Direct link:<br/>
        <a href="${escapeHtml(openHw)}" style="word-break:break-all;color:#0d9488">${escapeHtml(openHw)}</a></p>
        <p style="font-size:12px;color:#888;margin:0">Not signed in? <a href="${escapeHtml(signIn)}" style="color:#0d9488">Log in</a></p>`
      : "";

    const html = `
      <p>Hi ${escapeHtml(studentName)},</p>
      <p>Your teacher reviewed your work on <strong>${escapeHtml(hwTitle)}</strong> and left feedback.</p>
      ${preview ? `<div style="margin-top:14px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Teacher's feedback</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#374151;white-space:pre-wrap">${escapeHtml(preview).replace(/\n/g, "<br/>")}</p>
      </div>` : ""}
      ${attachmentsBlock}
      ${actions}
      <p style="margin-top:24px">— Your teacher</p>
    `.trim();

    const result = await sendTransactionalEmail({
      to: response.student.email,
      subject: `Feedback on your homework: ${hwTitle}`,
      html,
    });

    if (!result.ok) {
      console.error("[feedback-notify-email] failed", args.responseId, result.error);
    }
  } catch (e) {
    console.error("[feedback-notify-email] unexpected error", args.responseId, e);
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
      homework: { select: { id: true, title: true, description: true, attachments: true } },
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
    const hw = r.homework;
    const html = buildHomeworkEmailHtml({
      studentName: name,
      description: hw.description ?? "",
      homeworkId: hw.id,
      baseUrl,
      attachmentsJson: hw.attachments ?? "[]",
      leadHtml: `<p>This is a reminder about your homework <strong>${escapeHtml(hw.title)}</strong> before <strong>${escapeHtml(lessonFmt)}</strong>.</p>`,
    });

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
