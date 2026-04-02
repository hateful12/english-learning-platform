import { NextRequest, NextResponse } from "next/server";
import { sendDueHomeworkReminders } from "@/lib/homework-reminders";

/** Call on a schedule (e.g. hourly) with header `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueHomeworkReminders();
  return NextResponse.json(result);
}
