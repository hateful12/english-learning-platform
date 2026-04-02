import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Previous calendar date as yyyy-MM-dd (UTC date arithmetic on the Y-M-D triplet). */
function prevCalendarDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * 17:00 on the calendar day immediately before the lesson day, in `timeZone`.
 * Example: lesson Tue 10:00 → reminder Mon 17:00 local.
 */
export function reminderUtcBeforeLesson(lessonStartUtc: Date, timeZone: string): Date {
  const lessonYmd = formatInTimeZone(lessonStartUtc, timeZone, "yyyy-MM-dd");
  const prevYmd = prevCalendarDayYmd(lessonYmd);
  return fromZonedTime(`${prevYmd}T17:00:00`, timeZone);
}

export function getHomeworkReminderTimezone(): string {
  return process.env.HOMEWORK_REMINDER_TIMEZONE?.trim() || "Europe/Kyiv";
}
